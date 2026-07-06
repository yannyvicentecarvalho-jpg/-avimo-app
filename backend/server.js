const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3002', 'http://localhost:3003', 'http://169.254.0.21:3003', 'http://169.254.0.21:3002'],
    credentials: true
}));
app.use(express.json());

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Token não fornecido' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido' });
    }
};

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Preencha todos os campos' });
        }
        
        // Check if user already exists
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'Email já registrado' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );
        
        const user = result.rows[0];
        
        // Create ranking entry
        await pool.query(
            'INSERT INTO ranking (user_id, pontos) VALUES ($1, $2)',
            [user.id, 0]
        );
        
        // Create configuracoes entry
        await pool.query(
            'INSERT INTO configuracoes (user_id) VALUES ($1)',
            [user.id]
        );
        
        // Generate token
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
            message: 'Usuário registrado com sucesso',
            user,
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao registrar usuário' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email e senha são obrigatórios' });
        }
        
        // Find user
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Email ou senha inválidos' });
        }
        
        const user = result.rows[0];
        
        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Email ou senha inválidos' });
        }
        
        // Generate token
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            message: 'Login bem-sucedido',
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao fazer login' });
    }
});

// ==================== RENDA ROUTES ====================

// Get all rendas for user
app.get('/api/rendas', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rendas WHERE user_id = $1', [req.userId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar rendas' });
    }
});

// Add renda
app.post('/api/rendas', verifyToken, async (req, res) => {
    try {
        const { name, valor } = req.body;
        
        if (!name || !valor || valor <= 0) {
            return res.status(400).json({ message: 'Nome e valor são obrigatórios' });
        }
        
        const result = await pool.query(
            'INSERT INTO rendas (user_id, name, valor) VALUES ($1, $2, $3) RETURNING *',
            [req.userId, name, valor]
        );
        
        // Add to history
        await pool.query(
            'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [req.userId, 'renda', `Adicionou Renda: ${name}`, valor]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao adicionar renda' });
    }
});

// Delete renda
app.delete('/api/rendas/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const renda = await pool.query('SELECT * FROM rendas WHERE id = $1 AND user_id = $2', [id, req.userId]);
        
        if (renda.rows.length === 0) {
            return res.status(404).json({ message: 'Renda não encontrada' });
        }
        
        await pool.query('DELETE FROM rendas WHERE id = $1', [id]);
        
        // Add to history
        await pool.query(
            'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [req.userId, 'renda_deletada', `Deletou Renda: ${renda.rows[0].name}`, renda.rows[0].valor]
        );
        
        res.json({ message: 'Renda deletada com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao deletar renda' });
    }
});

// ==================== GASTOS ROUTES ====================

// Get all gastos for user
app.get('/api/gastos', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM gastos WHERE user_id = $1 ORDER BY data DESC', [req.userId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar gastos' });
    }
});

// Add gasto
app.post('/api/gastos', verifyToken, async (req, res) => {
    try {
        const { name, valor, data } = req.body;
        
        if (!name || !valor || valor <= 0 || !data) {
            return res.status(400).json({ message: 'Nome, valor e data são obrigatórios' });
        }
        
        const result = await pool.query(
            'INSERT INTO gastos (user_id, name, valor, data) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.userId, name, valor, data]
        );
        
        // Add to history
        await pool.query(
            'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [req.userId, 'gasto', `Adicionou Gasto: ${name}`, valor]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao adicionar gasto' });
    }
});

// Delete gasto
app.delete('/api/gastos/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const gasto = await pool.query('SELECT * FROM gastos WHERE id = $1 AND user_id = $2', [id, req.userId]);
        
        if (gasto.rows.length === 0) {
            return res.status(404).json({ message: 'Gasto não encontrado' });
        }
        
        await pool.query('DELETE FROM gastos WHERE id = $1', [id]);
        
        // Add to history
        await pool.query(
            'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [req.userId, 'gasto_deletado', `Deletou Gasto: ${gasto.rows[0].name}`, gasto.rows[0].valor]
        );
        
        res.json({ message: 'Gasto deletado com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao deletar gasto' });
    }
});

// ==================== INVESTIMENTOS ROUTES ====================

// Get all investimentos for user
app.get('/api/investimentos', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM investimentos WHERE user_id = $1', [req.userId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar investimentos' });
    }
});

// Add investimento
app.post('/api/investimentos', verifyToken, async (req, res) => {
    try {
        const { name, valor } = req.body;
        
        if (!name || !valor || valor <= 0) {
            return res.status(400).json({ message: 'Nome e valor são obrigatórios' });
        }
        
        const result = await pool.query(
            'INSERT INTO investimentos (user_id, name, valor) VALUES ($1, $2, $3) RETURNING *',
            [req.userId, name, valor]
        );
        
        // Add to history
        await pool.query(
            'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [req.userId, 'investimento', `Adicionou Investimento: ${name}`, valor]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao adicionar investimento' });
    }
});

// Delete investimento
app.delete('/api/investimentos/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const investimento = await pool.query('SELECT * FROM investimentos WHERE id = $1 AND user_id = $2', [id, req.userId]);
        
        if (investimento.rows.length === 0) {
            return res.status(404).json({ message: 'Investimento não encontrado' });
        }
        
        await pool.query('DELETE FROM investimentos WHERE id = $1', [id]);
        
        // Add to history
        await pool.query(
            'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [req.userId, 'investimento_deletado', `Deletou Investimento: ${investimento.rows[0].name}`, investimento.rows[0].valor]
        );
        
        res.json({ message: 'Investimento deletado com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao deletar investimento' });
    }
});

// ==================== CAIXINHAS ROUTES ====================

// Get all caixinhas for user
app.get('/api/caixinhas', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM caixinhas WHERE user_id = $1', [req.userId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar caixinhas' });
    }
});

// Add caixinha
app.post('/api/caixinhas', verifyToken, async (req, res) => {
    try {
        const { name, meta, valor } = req.body;
        
        if (!name || !meta || meta <= 0) {
            return res.status(400).json({ message: 'Nome e meta são obrigatórios' });
        }
        
        const result = await pool.query(
            'INSERT INTO caixinhas (user_id, name, meta, valor) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.userId, name, meta, valor || 0]
        );
        
        // Add to history
        await pool.query(
            'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [req.userId, 'caixinha', `Adicionou Caixinha: ${name}`, meta]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao adicionar caixinha' });
    }
});

// Add valor to caixinha
app.post('/api/caixinhas/:id/adicionar', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { valor } = req.body;
        
        if (!valor || valor <= 0) {
            return res.status(400).json({ message: 'Valor inválido' });
        }
        
        const caixinha = await pool.query('SELECT * FROM caixinhas WHERE id = $1 AND user_id = $2', [id, req.userId]);
        
        if (caixinha.rows.length === 0) {
            return res.status(404).json({ message: 'Caixinha não encontrada' });
        }
        
        const novoValor = parseFloat(caixinha.rows[0].valor) + parseFloat(valor);
        
        const result = await pool.query(
            'UPDATE caixinhas SET valor = $1 WHERE id = $2 RETURNING *',
            [novoValor, id]
        );
        
        // Add to history
        await pool.query(
            'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [req.userId, 'caixinha_adicionado', `Adicionou R$ ${valor} em ${caixinha.rows[0].name}`, valor]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao adicionar valor à caixinha' });
    }
});

// Delete caixinha
app.delete('/api/caixinhas/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const caixinha = await pool.query('SELECT * FROM caixinhas WHERE id = $1 AND user_id = $2', [id, req.userId]);
        
        if (caixinha.rows.length === 0) {
            return res.status(404).json({ message: 'Caixinha não encontrada' });
        }
        
        await pool.query('DELETE FROM caixinhas WHERE id = $1', [id]);
        
        // Add to history
        await pool.query(
            'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES ($1, $2, $3, $4)',
            [req.userId, 'caixinha_deletada', `Deletou Caixinha: ${caixinha.rows[0].name}`, caixinha.rows[0].meta]
        );
        
        res.json({ message: 'Caixinha deletada com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao deletar caixinha' });
    }
});

// ==================== DESAFIOS ROUTES ====================

// Get all desafios for user
app.get('/api/desafios', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM desafios WHERE user_id = $1', [req.userId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar desafios' });
    }
});

// Generate automatic desafios
app.post('/api/desafios/gerar', verifyToken, async (req, res) => {
    try {
        // Get user's financial data
        const rendas = await pool.query('SELECT SUM(valor) as total FROM rendas WHERE user_id = $1', [req.userId]);
        const gastos = await pool.query('SELECT SUM(valor) as total FROM gastos WHERE user_id = $1', [req.userId]);
        const investimentos = await pool.query('SELECT SUM(valor) as total FROM investimentos WHERE user_id = $1', [req.userId]);
        
        const totalRendas = parseFloat(rendas.rows[0].total) || 0;
        const totalGastos = parseFloat(gastos.rows[0].total) || 0;
        const totalInvestimentos = parseFloat(investimentos.rows[0].total) || 0;
        
        if (totalRendas === 0) {
            return res.status(400).json({ message: 'Configure sua renda primeiro' });
        }
        
        const sobra = totalRendas - totalGastos;
        const margemEmergencia = totalRendas * 0.15;
        const disponivel = sobra - margemEmergencia;
        
        if (disponivel <= 0) {
            return res.status(400).json({ message: 'Você não tem sobra para desafios agora' });
        }
        
        // Delete old desafios
        await pool.query('DELETE FROM desafios WHERE user_id = $1', [req.userId]);
        
        // Create 4 new desafios
        const nomeMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const percentuais = [0.5, 0.6, 0.7, 0.8];
        const pontosBase = 100;
        
        const dataAtual = new Date();
        const mesAtual = dataAtual.getMonth();
        
        for (let i = 0; i < 4; i++) {
            const metaMensal = disponivel * percentuais[i];
            const dataInicio = new Date(dataAtual.getFullYear(), mesAtual + i, 1);
            const dataFim = new Date(dataAtual.getFullYear(), mesAtual + i + 1, 0);
            const nomeMes = nomeMeses[(mesAtual + i) % 12];
            
            await pool.query(
                'INSERT INTO desafios (user_id, name, meta, progresso, pontos, data_inicio, data_fim, ativo, concluido) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [req.userId, `Desafio ${nomeMes}`, metaMensal, 0, pontosBase + (i * 25), dataInicio, dataFim, true, false]
            );
        }
        
        // Update ranking
        await pool.query('UPDATE ranking SET pontos = 0 WHERE user_id = $1', [req.userId]);
        
        res.json({
            message: 'Desafios gerados com sucesso',
            disponivel,
            desafios: percentuais.map((p, i) => ({
                mes: nomeMeses[(mesAtual + i) % 12],
                meta: disponivel * p,
                pontos: pontosBase + (i * 25)
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao gerar desafios' });
    }
});

// Add progresso to desafio
app.post('/api/desafios/:id/progresso', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { valor } = req.body;
        
        if (!valor || valor <= 0) {
            return res.status(400).json({ message: 'Valor inválido' });
        }
        
        const desafio = await pool.query('SELECT * FROM desafios WHERE id = $1 AND user_id = $2', [id, req.userId]);
        
        if (desafio.rows.length === 0) {
            return res.status(404).json({ message: 'Desafio não encontrado' });
        }
        
        const novoProgresso = Math.min(parseFloat(desafio.rows[0].progresso) + parseFloat(valor), parseFloat(desafio.rows[0].meta));
        const concluido = novoProgresso >= desafio.rows[0].meta;
        
        const result = await pool.query(
            'UPDATE desafios SET progresso = $1, concluido = $2, ativo = $3 WHERE id = $4 RETURNING *',
            [novoProgresso, concluido, !concluido, id]
        );
        
        // Update ranking if completed
        if (concluido) {
            const ranking = await pool.query('SELECT pontos FROM ranking WHERE user_id = $1', [req.userId]);
            const novosPontos = (ranking.rows[0]?.pontos || 0) + desafio.rows[0].pontos;
            await pool.query('UPDATE ranking SET pontos = $1 WHERE user_id = $2', [novosPontos, req.userId]);
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao adicionar progresso' });
    }
});

// ==================== RANKING ROUTES ====================

// Get global ranking
app.get('/api/ranking', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, r.pontos, r.badges
            FROM ranking r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.pontos DESC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar ranking' });
    }
});

// Get user ranking
app.get('/api/ranking/user', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ranking WHERE user_id = $1', [req.userId]);
        res.json(result.rows[0] || { pontos: 0, badges: [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar ranking do usuário' });
    }
});

// ==================== CONFIGURACOES ROUTES ====================

// Get configuracoes
app.get('/api/configuracoes', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM configuracoes WHERE user_id = $1', [req.userId]);
        res.json(result.rows[0] || {});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar configurações' });
    }
});

// Update configuracoes
app.put('/api/configuracoes', verifyToken, async (req, res) => {
    try {
        const { dias_recebimento, frequencia_recebimento } = req.body;
        
        const result = await pool.query(
            'UPDATE configuracoes SET dias_recebimento = $1, frequencia_recebimento = $2 WHERE user_id = $3 RETURNING *',
            [JSON.stringify(dias_recebimento), frequencia_recebimento, req.userId]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar configurações' });
    }
});

// ==================== HISTORICO ROUTES ====================

// Get historico
app.get('/api/historico', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM historico WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar histórico' });
    }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
    res.json({ message: 'Server is running' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
