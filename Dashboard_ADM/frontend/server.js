const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = 5500;

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
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Conexão com o banco de dados
let dbInstituicao;

(async function initializeDatabase() {
  try {
    dbInstituicao = await mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: 'cimatec',
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

// Middleware de logging aprimorado
app.use((req, res, next) => {
  log(`📥 ${req.method} ${req.url}`);
  log(`Headers: ${JSON.stringify(req.headers)}`);
  next();
});

// Rota POST /api/colaboradores corrigida
app.post('/api/colaboradores', upload.single('profile-picture'), async (req, res) => {
  try {
    log('Recebendo requisição para /api/colaboradores');
    
    // Extrai os campos do formulário
    const { primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, senha } = req.body;
    
    // Validação dos campos obrigatórios
    if (!primeiro_nome || !email || !nome_usuario || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios faltando',
        message: 'Por favor, preencha todos os campos obrigatórios'
      });
    }

    const conn = await dbInstituicao.getConnection();
    
    try {
      // Verifica se o usuário já existe
      const [existing] = await conn.query(
        'SELECT id FROM colaboradores WHERE email = ? OR nome_usuario = ? LIMIT 1',
        [email, nome_usuario]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Usuário já existe',
          message: 'E-mail ou nome de usuário já cadastrado'
        });
      }

      // Processa a foto se foi enviada
      let foto_perfil = null;
      if (req.file) {
        foto_perfil = `/uploads/${req.file.filename}`;
        log(`Arquivo recebido: ${foto_perfil}`);
      }

      // Insere no banco de dados
      const [result] = await conn.query(
        `INSERT INTO colaboradores 
        (primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, senha, foto_perfil) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          primeiro_nome,
          ultimo_nome || null,
          numero_contato || null,
          email,
          nome_usuario,
          senha, // Na prática, você deve usar bcrypt para hashear a senha
          foto_perfil
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Colaborador cadastrado com sucesso',
        data: {
          id: result.insertId,
          primeiro_nome,
          email,
          nome_usuario
        }
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    log(`Erro no cadastro de colaborador: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: 'Ocorreu um erro ao cadastrar o colaborador'
    });
  }
});

app.delete('/api/colaboradores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido',
        message: 'Por favor, forneça um ID válido'
      });
    }

    const conn = await dbInstituicao.getConnection();
    
    try {
      // Verifica se o colaborador existe
      const [colaborador] = await conn.query(
        'SELECT id, foto_perfil FROM colaboradores WHERE id = ?',
        [id]
      );

      if (colaborador.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Não encontrado',
          message: 'Colaborador não encontrado'
        });
      }

      // Remove o colaborador
      await conn.query('DELETE FROM colaboradores WHERE id = ?', [id]);

      // Se tiver foto, remove o arquivo
      if (colaborador[0].foto_perfil) {
        const fotoPath = path.join(__dirname, colaborador[0].foto_perfil.replace('/uploads/', 'uploads/'));
        if (fs.existsSync(fotoPath)) {
          fs.unlinkSync(fotoPath);
        }
      }

      res.json({
        success: true,
        message: 'Colaborador removido com sucesso'
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    log(`Erro ao excluir colaborador: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: 'Ocorreu um erro ao excluir o colaborador',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Rota GET para buscar todas as atividades (coloque isso ANTES das rotas genéricas de erro)
app.get('/api/atividades', async (req, res) => {
  try {
    const { start, end } = req.query;
    const conn = await dbInstituicao.getConnection();
    
    try {
      let query = `
        SELECT 
          id,
          descricao as atividade,
          DATE_FORMAT(datasAtividadeIndividual, '%Y-%m-%d') as data,
          DATE_FORMAT(horaInicioAgendada, '%H:%i') as horaInicio,
          DATE_FORMAT(fimAgendado, '%H:%i') as horaFim,
          nomePessoalAtribuido as instrutor,
          descricaoLocalizacaoAtribuida as local,
          confirmada as status
        FROM atividades
      `;
      
      let params = [];
      
      if (start && end) {
        query += ' WHERE datasAtividadeIndividual BETWEEN ? AND ?';
        params.push(start, end);
      }
      
      query += ' ORDER BY datasAtividadeIndividual, horaInicioAgendada';
      
      const [atividades] = await conn.query(query, params);
      
      console.log(`Retornando ${atividades.length} atividades`); // Log para depuração
      
      res.json({
        success: true,
        data: atividades
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Erro completo:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: error.message
    });
  }
});


// Tratamento para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Rota não encontrada',
    message: `A rota ${req.method} ${req.url} não foi encontrada`
  });
});

// Tratamento global de erros
app.use((error, req, res, next) => {
  log(`Erro não tratado: ${error.stack}`);
  res.status(500).json({ 
    success: false,
    error: 'Erro interno no servidor',
    message: 'Ocorreu um erro inesperado no servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Inicialização do servidor
app.listen(PORT, '0.0.0.0', () => {
  log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

// Tratamento de eventos não capturados
process.on('uncaughtException', (err) => {
  log(`🔥 ERRO GRAVE: ${err.stack}`);
  // Você pode querer reiniciar o servidor aqui em produção
});

process.on('unhandledRejection', (reason, promise) => {
  log(`⚠️ PROMISE REJEITADA: ${reason}`);
  log(`Promise: ${promise}`);
});


// Rota PUT para atualizar atividades (adicione junto com as outras rotas)
app.put('/api/atividades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      descricao, 
      nomePessoalAtribuido, 
      horaInicioAgendada, 
      descricaoLocalizacaoAtribuida,
    } = req.body;

    const conn = await dbInstituicao.getConnection();
    
    try {
      const [result] = await conn.query(
        `UPDATE atividades SET
          descricao = ?,
          nomePessoalAtribuido = ?,
          horaInicioAgendada = ?,
          descricaoLocalizacaoAtribuida = ?
        WHERE id = ?`,
        [
          descricao,
          nomePessoalAtribuido,
          horaInicioAgendada,
          descricaoLocalizacaoAtribuida,
          id
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Atividade não encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Atividade atualizada com sucesso'
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    log(`Erro ao atualizar atividade: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor'
    });
  }
});


// Rota GET para buscar uma atividade específica por ID
app.get('/api/atividades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido',
        message: 'Por favor, forneça um ID válido'
      });
    }

    const conn = await dbInstituicao.getConnection();
    
    try {
      const [atividades] = await conn.query(
        `SELECT 
          id,
          descricao as atividade,
          DATE_FORMAT(horaInicioAgendada, '%H:%i') as hora,
          nomePessoalAtribuido as instrutor,
          descricaoLocalizacaoAtribuida as local,
          confirmada as status,

          datasAtividadeIndividual as data
        FROM atividades
        WHERE id = ?`,
        [id]
      );

      if (atividades.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Não encontrado',
          message: 'Atividade não encontrada'
        });
      }

      res.json({
        success: true,
        data: atividades[0]
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    log(`Erro ao buscar atividade: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: 'Ocorreu um erro ao buscar a atividade'
    });
  }
});

