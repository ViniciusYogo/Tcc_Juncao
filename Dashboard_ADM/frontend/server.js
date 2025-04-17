const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const port = 5500;

// Configurações gerais
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logStream = fs.createWriteStream(path.join(logDir, 'server.log'), { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logStream.write(logMessage);
  console.log(logMessage);
}

// Configuração do Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// Conexão com o banco de dados
let dbInstituicao;

(async function initializeDatabase() {
  try {
    dbInstituicao = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '102030',
      database: 'INSTITUICAO',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    log('✅ Conexão com o banco de dados estabelecida com sucesso!');
  } catch (err) {
    log(`❌ Erro ao conectar ao banco de dados: ${err.message}`);
    process.exit(1);
  }
})();

// Middlewares
app.use(cors({
  origin: 'http://localhost:5500',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  log(`📥 ${req.method} ${req.url}`);
  next();
});

// Rotas para Atividades
app.get('/api/atividades', async (req, res) => {
  try {
    const [rows] = await dbInstituicao.query('SELECT * FROM atividades');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/atividades', async (req, res) => {
  console.log('Recebendo dados:', req.body);
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ 
        success: false,
        error: 'O corpo da requisição deve ser um array' 
      });
    }

    const conn = await dbInstituicao.getConnection();
    let inserted = 0, skipped = 0;
    
    for (const atividade of req.body) {
      console.log('Processando atividade:', atividade);
      const datas = Array.isArray(atividade.datasAtividadeIndividual) 
        ? atividade.datasAtividadeIndividual 
        : (atividade.datasAtividadeIndividual ? atividade.datasAtividadeIndividual.split(';') : []);
      
      for (const data of datas) {
        if (!data) continue;
        
        const [existing] = await conn.query(
          `SELECT * FROM atividades WHERE 
           descricao = ? AND nomePessoalAtribuido = ? AND datasAtividadeIndividual = ?`,
          [atividade.descricao, atividade.nomePessoalAtribuido, data]
        );

        if (existing.length === 0) {
          await conn.query(`INSERT INTO atividades SET ?`, {
            descricao: atividade.descricao,
            nomePessoalAtribuido: atividade.nomePessoalAtribuido,
            horaInicioAgendada: atividade.horaInicioAgendada || '00:00:00',
            fimAgendado: atividade.fimAgendado || '00:00:00',
            datasAtividadeIndividual: data,
            descricaoLocalizacaoAtribuida: atividade.descricaoLocalizacaoAtribuida || '',
            confirmada: atividade.confirmada || false
          });
          inserted++;
        } else {
          skipped++;
        }
      }
    }
    conn.release();
    res.json({ 
      success: true, 
      inserted, 
      skipped,
      message: `Dados processados com sucesso. Inseridos: ${inserted}, Ignorados: ${skipped}`
    });
  } catch (error) {
    console.error('Erro ao processar a requisição:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro interno no servidor',
      details: error.message
    });
  }
});

// Outras rotas (colaboradores, etc.) permanecem as mesmas...

// Inicialização do servidor
app.listen(port, '0.0.0.0', () => {
  log(`🚀 Servidor rodando em http://localhost:${port}`);
});

process.on('uncaughtException', (err) => {
  log(`🔥 ERRO GRAVE: ${err.stack}`);
});

process.on('unhandledRejection', (reason) => {
  log(`⚠️ PROMISE REJEITADA: ${reason}`);
});