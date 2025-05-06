const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const app = express();

// CONEXÃO COM BANCO DE DADOS
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '102030',
  database: 'instituicao'
});

// CONECTAR
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err);
  } else {
    console.log('Conectado ao banco de dados MySQL.');
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Servir a pasta do Dashboard
app.use('/Dashboard_ADM/frontend', express.static(path.join(__dirname, '../Dashboard_ADM/frontend')));

// ROTA PRINCIPAL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ROTA DE LOGIN
app.post('/login', (req, res) => {
  const { email, senha } = req.body;

  const sql = 'SELECT * FROM administrador WHERE email = ? AND senha = ?';
  db.query(sql, [email, senha], (err, result) => {
    if (err) return res.status(500).send('Erro no servidor.');

    if (result.length > 0) {
      return res.redirect('/Dashboard_ADM/frontend/');
    } else {
      return res.send('<script>alert("Email ou senha inválidos!"); window.history.back();</script>');
    }
  });
});

const PORT = 5500;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
