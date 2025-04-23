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

// Rota consolidada para atividades - substitui as duas versões
app.get('/api/atividades', async (req, res) => {
  try {
    const { dia, mes, ano } = req.query;
    const conn = await dbInstituicao.getConnection();
    
    let query = `
      SELECT 
        id,
        descricao,
        nomePessoalAtribuido as responsavel,
        diasAgendados,
        horaInicioAgendada as horario_inicio,
        fimAgendado as horario_fim,
        datasAtividadeIndividual as data,
        descricaoLocalizacaoAtribuida as localizacao,
        confirmada as status
    `;

    // Se for consulta detalhada por data, adiciona campos específicos
    if (dia && mes && ano) {
      query = `
        SELECT 
          id,
          descricao as atividade,
          DATE_FORMAT(horaInicioAgendada, '%H:%i') as hora,
          nomePessoalAtribuido as instrutor,
          descricaoLocalizacaoAtribuida as localizacao,
          confirmada as status,
          10 as vagas
      `;
    }

    query += ` FROM atividades `;

    // Filtro por data se existir nos parâmetros
    if (dia && mes && ano) {
      const dataFormatada = `${ano}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
      query += ` WHERE DATE(datasAtividadeIndividual) = ? `;
      var params = [dataFormatada];
    }

    query += ` ORDER BY datasAtividadeIndividual ASC`;
    
    const [atividades] = await conn.query(query, params || []);
    conn.release();

    if (!atividades || atividades.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Nenhuma atividade encontrada' 
      });
    }

    res.json({
      success: true,
      data: atividades
    });

  } catch (error) {
    log(`Erro ao buscar atividades: ${error.stack}`);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao buscar atividades',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});






app.get('/api/atividades/por-data', async (req, res) => {
  try {
    const { data } = req.query;
    
    if (!data) {
      return res.status(400).json({ 
        success: false,
        error: 'Parâmetro "data" é obrigatório',
        message: 'Por favor, forneça uma data para consulta'
      });
    }

    const conn = await dbInstituicao.getConnection();
    const [atividades] = await conn.query(
      `SELECT * FROM atividades 
       WHERE DATE(datasAtividadeIndividual) = ? 
       ORDER BY horaInicioAgendada ASC`,
      [data]
    );
    conn.release();

    res.json({
      success: true,
      data: atividades
    });
  } catch (error) {
    log(`Erro ao buscar atividades por data: ${error.stack}`);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao buscar atividades por data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/atividades', async (req, res) => {
  log('Dados recebidos: ' + JSON.stringify(req.body, null, 2));
  
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ 
        success: false,
        error: 'Formato inválido',
        message: 'O corpo da requisição deve ser um array' 
      });
    }

    const conn = await dbInstituicao.getConnection();
    let inserted = 0, errors = 0;
    const errorsList = [];
    
    for (const [index, atividade] of req.body.entries()) {
      try {
        // Verifica se já existe uma atividade igual
        const [existing] = await conn.query(
          `SELECT id FROM atividades WHERE 
           descricao = ? AND nomePessoalAtribuido = ? AND datasAtividadeIndividual = ?
           LIMIT 1`,
          [
            atividade.descricao || '', 
            atividade.nomePessoalAtribuido || '', 
            atividade.datasAtividadeIndividual || ''
          ]
        );

        if (existing.length === 0) {
          await conn.query(`INSERT INTO atividades SET ?`, {
            descricao: atividade.descricao || '',
            nomePessoalAtribuido: atividade.nomePessoalAtribuido || '',
            diasAgendados: atividade.diasAgendados || '',
            horaInicioAgendada: atividade.horaInicioAgendada || '00:00:00',
            fimAgendado: atividade.fimAgendado || '00:00:00',
            datasAtividadeIndividual: atividade.datasAtividadeIndividual || '',
            descricaoLocalizacaoAtribuida: atividade.descricaoLocalizacaoAtribuida || '',
            confirmada: atividade.confirmada || false
          });
          inserted++;
        } else {
          errors++;
          errorsList.push(`Linha ${index + 1}: Registro duplicado`);
        }
      } catch (error) {
        errors++;
        errorsList.push(`Linha ${index + 1}: ${error.message}`);
        log(`Erro na linha ${index + 1}: ${error.message}`);
      }
    }
    
    conn.release();
    
    res.json({ 
      success: true, 
      inserted, 
      errors,
      errorsList,
      message: `Processamento completo. Inseridos: ${inserted}, Erros: ${errors}`
    });
  } catch (error) {
    log(`Erro geral ao processar a requisição: ${error.stack}`);
    res.status(500).json({ 
      success: false,
      error: 'Erro interno no servidor',
      message: 'Ocorreu um erro ao processar as atividades',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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