import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const API_URL = 'http://localhost:3000/api';

function Dashboard({ token, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [rendas, setRendas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [investimentos, setInvestimentos] = useState([]);
  const [caixinhas, setCaixinhas] = useState([]);
  const [desafios, setDesafios] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [userRanking, setUserRanking] = useState(null);
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [rendasRes, gastosRes, investimentosRes, caixinhasRes, desafiosRes, rankingRes, userRankingRes] = await Promise.all([
        axios.get(`${API_URL}/rendas`, { headers }),
        axios.get(`${API_URL}/gastos`, { headers }),
        axios.get(`${API_URL}/investimentos`, { headers }),
        axios.get(`${API_URL}/caixinhas`, { headers }),
        axios.get(`${API_URL}/desafios`, { headers }),
        axios.get(`${API_URL}/ranking`, { headers }),
        axios.get(`${API_URL}/ranking/user`, { headers })
      ]);

      setRendas(rendasRes.data);
      setGastos(gastosRes.data);
      setInvestimentos(investimentosRes.data);
      setCaixinhas(caixinhasRes.data);
      setDesafios(desafiosRes.data);
      setRanking(rankingRes.data);
      setUserRanking(userRankingRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const addRenda = async (e) => {
    e.preventDefault();
    const name = e.target.nomeRenda.value;
    const valor = parseFloat(e.target.valorRenda.value);

    try {
      await axios.post(`${API_URL}/rendas`, { name, valor }, { headers });
      e.target.reset();
      loadAllData();
    } catch (err) {
      alert('Erro ao adicionar renda');
    }
  };

  const addGasto = async (e) => {
    e.preventDefault();
    const name = e.target.nomeGasto.value;
    const valor = parseFloat(e.target.valorGasto.value);
    const data = e.target.dataGasto.value;

    try {
      await axios.post(`${API_URL}/gastos`, { name, valor, data }, { headers });
      e.target.reset();
      loadAllData();
    } catch (err) {
      alert('Erro ao adicionar gasto');
    }
  };

  const addInvestimento = async (e) => {
    e.preventDefault();
    const name = e.target.nomeInvestimento.value;
    const valor = parseFloat(e.target.valorInvestimento.value);

    try {
      await axios.post(`${API_URL}/investimentos`, { name, valor }, { headers });
      e.target.reset();
      loadAllData();
    } catch (err) {
      alert('Erro ao adicionar investimento');
    }
  };

  const addCaixinha = async (e) => {
    e.preventDefault();
    const name = e.target.nomeCaixinha.value;
    const meta = parseFloat(e.target.metaCaixinha.value);
    const valor = parseFloat(e.target.valorCaixinha.value) || 0;

    try {
      await axios.post(`${API_URL}/caixinhas`, { name, meta, valor }, { headers });
      e.target.reset();
      loadAllData();
    } catch (err) {
      alert('Erro ao adicionar caixinha');
    }
  };

  const gerarDesafios = async () => {
    try {
      await axios.post(`${API_URL}/desafios/gerar`, {}, { headers });
      loadAllData();
      alert('Desafios gerados com sucesso!');
    } catch (err) {
      alert(err.response?.data?.message || 'Erro ao gerar desafios');
    }
  };

  const totalRendas = rendas.reduce((sum, r) => sum + r.valor, 0);
  const totalGastos = gastos.reduce((sum, g) => sum + g.valor, 0);
  const totalInvestimentos = investimentos.reduce((sum, i) => sum + i.valor, 0);
  const totalCaixinhas = caixinhas.reduce((sum, c) => sum + c.valor, 0);
  const saldo = totalRendas - totalGastos;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🎯 Avimo</h1>
        <div className="user-info">
          <span>Bem-vindo, {user?.name}!</span>
          <button onClick={onLogout} className="logout-btn">Sair</button>
        </div>
      </header>

      <div className="tabs">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>Home</button>
        <button className={activeTab === 'rendas' ? 'active' : ''} onClick={() => setActiveTab('rendas')}>Rendas</button>
        <button className={activeTab === 'gastos' ? 'active' : ''} onClick={() => setActiveTab('gastos')}>Gastos</button>
        <button className={activeTab === 'investimentos' ? 'active' : ''} onClick={() => setActiveTab('investimentos')}>Investimentos</button>
        <button className={activeTab === 'caixinhas' ? 'active' : ''} onClick={() => setActiveTab('caixinhas')}>Caixinhas</button>
        <button className={activeTab === 'desafios' ? 'active' : ''} onClick={() => setActiveTab('desafios')}>Desafios</button>
        <button className={activeTab === 'ranking' ? 'active' : ''} onClick={() => setActiveTab('ranking')}>Ranking</button>
      </div>

      <div className="content">
        {activeTab === 'home' && (
          <div className="home">
            <div className="summary">
              <div className="card">
                <h3>💰 Renda Total</h3>
                <p>R$ {totalRendas.toFixed(2)}</p>
              </div>
              <div className="card">
                <h3>💸 Gastos Total</h3>
                <p>R$ {totalGastos.toFixed(2)}</p>
              </div>
              <div className="card">
                <h3>📈 Investimentos</h3>
                <p>R$ {totalInvestimentos.toFixed(2)}</p>
              </div>
              <div className="card saldo">
                <h3>✨ Saldo</h3>
                <p>R$ {saldo.toFixed(2)}</p>
              </div>
            </div>

            {userRanking && (
              <div className="user-ranking">
                <h3>🏆 Seus Pontos: {userRanking.pontos}</h3>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rendas' && (
          <div className="section">
            <h2>Adicionar Renda</h2>
            <form onSubmit={addRenda}>
              <input type="text" name="nomeRenda" placeholder="Nome da renda" required />
              <input type="number" name="valorRenda" placeholder="Valor" step="0.01" required />
              <button type="submit">Adicionar</button>
            </form>

            <h3>Minhas Rendas</h3>
            <ul>
              {rendas.map(r => (
                <li key={r.id}>{r.name}: R$ {r.valor.toFixed(2)}</li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'gastos' && (
          <div className="section">
            <h2>Adicionar Gasto</h2>
            <form onSubmit={addGasto}>
              <input type="text" name="nomeGasto" placeholder="Nome do gasto" required />
              <input type="number" name="valorGasto" placeholder="Valor" step="0.01" required />
              <input type="date" name="dataGasto" required />
              <button type="submit">Adicionar</button>
            </form>

            <h3>Meus Gastos</h3>
            <ul>
              {gastos.map(g => (
                <li key={g.id}>{g.name}: R$ {g.valor.toFixed(2)} ({g.data})</li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'investimentos' && (
          <div className="section">
            <h2>Adicionar Investimento</h2>
            <form onSubmit={addInvestimento}>
              <input type="text" name="nomeInvestimento" placeholder="Nome do investimento" required />
              <input type="number" name="valorInvestimento" placeholder="Valor" step="0.01" required />
              <button type="submit">Adicionar</button>
            </form>

            <h3>Meus Investimentos</h3>
            <ul>
              {investimentos.map(i => (
                <li key={i.id}>{i.name}: R$ {i.valor.toFixed(2)}</li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'caixinhas' && (
          <div className="section">
            <h2>Adicionar Caixinha</h2>
            <form onSubmit={addCaixinha}>
              <input type="text" name="nomeCaixinha" placeholder="Nome da caixinha" required />
              <input type="number" name="metaCaixinha" placeholder="Meta" step="0.01" required />
              <input type="number" name="valorCaixinha" placeholder="Valor inicial" step="0.01" />
              <button type="submit">Adicionar</button>
            </form>

            <h3>Minhas Caixinhas</h3>
            <ul>
              {caixinhas.map(c => {
                const percentual = (c.valor / c.meta * 100).toFixed(0);
                return (
                  <li key={c.id}>
                    {c.name}: R$ {c.valor.toFixed(2)} / R$ {c.meta.toFixed(2)} ({percentual}%)
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activeTab === 'desafios' && (
          <div className="section">
            <h2>Desafios</h2>
            <button onClick={gerarDesafios} className="gerar-btn">Gerar Desafios Automáticos</button>

            <h3>Meus Desafios</h3>
            <ul>
              {desafios.map(d => {
                const percentual = (d.progresso / d.meta * 100).toFixed(0);
                return (
                  <li key={d.id}>
                    {d.name}: R$ {d.progresso.toFixed(2)} / R$ {d.meta.toFixed(2)} ({percentual}%) - {d.pontos} pontos
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activeTab === 'ranking' && (
          <div className="section">
            <h2>🏅 Ranking Global</h2>
            <ol>
              {ranking.map((r, idx) => (
                <li key={r.id}>
                  {idx + 1}. {r.name}: {r.pontos} pontos
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
