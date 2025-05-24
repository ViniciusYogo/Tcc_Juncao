const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');
const bodyParser = require('body-parser');
const fileupload = require('express-fileupload');
const session = require('express-session');
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

// Configuração de sessão
app.use(session({
  secret: 'sua_chave_secreta_super_segura_123',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Apenas arquivos Excel são permitidos'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Conexão com o banco de dados
let db;

(async function initializeDatabase() {
  try {
    db = await mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '102030',
      database: 'instituicao',
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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.use(fileupload({
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'temp'),
  limits: { fileSize: 5 * 1024 * 1024 },
  abortOnLimit: true,
  responseOnLimit: 'O arquivo é muito grande (limite de 5MB)',
  safeFileNames: true,
  preserveExtension: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/Dashboard_ADM/frontend', express.static(path.join(__dirname, '../Dashboard_ADM/frontend')));

// Middleware de logging
app.use((req, res, next) => {
  log(`📥 ${req.method} ${req.url}`);
  next();
});

// Middleware de autenticação para rotas protegidas
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Não autorizado' });
};

// Middleware de verificação de função
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user || !req.session.user.funcao) {
      return res.status(403).json({ 
        error: 'Acesso negado',
        message: 'Função do usuário não definida'
      });
    }

    if (roles.includes(req.session.user.funcao)) {
      return next();
    }

    res.status(403).json({ 
      error: 'Acesso negado',
      message: `Esta ação requer uma das seguintes funções: ${roles.join(', ')}`
    });
  };
};



// ROTAS PÚBLICAS
app.get('/', (req, res) => {
  if (req.session.authenticated) {
    const redirectPath = req.session.user.funcao === 'admin' 
      ? '/Dashboard_ADM/frontend/?funcao=admin' 
      : '/Dashboard_ADM/frontend/?funcao=professor';
    return res.redirect(redirectPath);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota de login 
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  // Validação básica dos campos
  if (!email || !senha) {
    return res.status(400).json({
      success: false,
      error: 'E-mail e senha são obrigatórios'
    });
  }

  try {
    // Primeiro verifica se o usuário existe (independente da função)
    const [users] = await db.query(
      'SELECT id, email, funcao, primeiro_nome, ultimo_nome FROM colaboradores WHERE email = ? AND senha = ?',
      [email, senha]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    const user = users[0];
    
    // Cria a sessão
    req.session.regenerate(err => {
      if (err) {
        console.error('Erro ao regenerar sessão:', err);
        return res.status(500).json({
          success: false,
          error: 'Erro interno no servidor'
        });
      }

      req.session.authenticated = true;
      req.session.user = {
        id: user.id,
        email: user.email,
        nome: `${user.primeiro_nome} ${user.ultimo_nome}`,
        funcao: user.funcao
      };

      // Salva a sessão
      req.session.save(err => {
        if (err) {
          console.error('Erro ao salvar sessão:', err);
          return res.status(500).json({
            success: false,
            error: 'Erro interno no servidor'
          });
        }

        // Redireciona conforme a função
        return res.json({
          success: true,
          redirect: `/Dashboard_ADM/frontend/?funcao=${user.funcao}`,
          user: {
            nome: `${user.primeiro_nome} ${user.ultimo_nome}`,
            funcao: user.funcao
          }
        });
      });
    });

  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no servidor'
    });
  }
});

// Rota de logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Erro ao fazer logout');
    }
    res.redirect('/');
  });
});

// Rota para obter permissões do usuário
app.get('/api/user-permissions', requireAuth, (req, res) => {
  const isAdmin = req.session.user.funcao === 'admin';
  const isProfessor = req.session.user.funcao === 'professor';

  res.json({
    success: true,
    data: {
      isAdmin,
      isProfessor,
      canViewUsers: isAdmin,
      canCreateUsers: isAdmin,
      canEditUsers: isAdmin,
      canDeleteUsers: isAdmin,
      canUploadFiles: isAdmin,
      canViewSchedules: true,
      canManageSchedules: isAdmin,
      canViewSettings: true,
      canManageSettings: isAdmin
    }
  });
});

// Rota do dashboard (protegida)
app.get('/Dashboard_ADM/frontend', requireAuth, (req, res) => {
  const dashboardPath = path.join(__dirname, 'Dashboard_ADM', 'frontend', 'index.html');
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.status(404).json({
      success: false,
      error: 'Dashboard não encontrado'
    });
  }
});

// ROTAS DE ADMINISTRAÇÃO (apenas para admin)
app.get('/api/colaboradores',
  requireAuth,
  checkRole(['admin']),
  async (req, res) => {
    try {
      const [colaboradores] = await db.query('SELECT * FROM colaboradores');
      res.json(colaboradores);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar colaboradores' });
    }
  }
);

app.post('/api/criar-colaborador',
  requireAuth,
  checkRole(['admin']),
  async (req, res) => {
    try {
      const {
        primeiro_nome,
        ultimo_nome,
        numero_contato,
        email,
        nome_usuario,
        senha,
        funcao
      } = req.body;

      let foto = null;
      if (req.files && req.files.foto) {
        const fotoFile = req.files.foto;
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        
        const ext = path.extname(fotoFile.name);
        const fileName = `${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);
        
        await fotoFile.mv(filePath);
        foto = fileName;
      }

      const [result] = await db.query(
        `INSERT INTO colaboradores SET ?`,
        {
          primeiro_nome,
          ultimo_nome,
          numero_contato,
          email,
          nome_usuario,
          senha,
          foto,
          funcao: funcao || 'professor' // Default para professor
        }
      );

      res.status(201).json({
        success: true,
        message: 'Colaborador criado com sucesso!',
        id: result.insertId
      });
    } catch (err) {
      console.error('Erro ao criar colaborador:', err);
      res.status(500).json({
        success: false,
        error: 'Erro interno no servidor'
      });
    }
  }
);

app.put('/api/colaboradores/:id',
  requireAuth,
  checkRole(['admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      let foto = null;

      if (req.files && req.files.foto) {
        const fotoFile = req.files.foto;
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        
        const ext = path.extname(fotoFile.name);
        const fileName = `${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);
        
        await fotoFile.mv(filePath);
        foto = fileName;
      }

      const {
        primeiro_nome,
        ultimo_nome,
        numero_contato,
        email,
        nome_usuario,
        senha,
        funcao
      } = req.body;

      const updateData = {
        primeiro_nome,
        ultimo_nome,
        numero_contato,
        email,
        nome_usuario,
        funcao
      };

      if (senha && senha.trim() !== '') {
        updateData.senha = senha;
      }

      if (foto) {
        updateData.foto = foto;
      }

      const [result] = await db.query(
        'UPDATE colaboradores SET ? WHERE id = ?',
        [updateData, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Colaborador não encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Colaborador atualizado com sucesso!'
      });
    } catch (err) {
      console.error('Erro ao atualizar colaborador:', err);
      res.status(500).json({
        success: false,
        error: 'Erro ao atualizar colaborador'
      });
    }
  }
);

app.delete('/api/colaboradores/:id',
  requireAuth,
  checkRole(['admin']),
  async (req, res) => {
    try {
      const [result] = await db.query(
        'DELETE FROM colaboradores WHERE id = ?',
        [req.params.id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Colaborador não encontrado' 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Colaborador excluído com sucesso!' 
      });
    } catch (err) {
      res.status(500).json({ 
        success: false,
        error: 'Erro ao excluir colaborador' 
      });
    }
  }
);

// ROTAS DE ATIVIDADES
// Visualização para todos autenticados
app.get('/api/atividades', requireAuth, async (req, res) => {
  try {
    const { start, end } = req.query;
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

    const [atividades] = await db.query(query, params);
    res.json({ success: true, data: atividades });
  } catch (error) {
    log(`Erro ao buscar atividades: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor'
    });
  }
});

app.get('/api/atividades/:id', requireAuth, async (req, res) => {
  try {
    const [atividade] = await db.query(
      `SELECT 
        id,
        descricao as atividade,
        DATE_FORMAT(datasAtividadeIndividual, '%Y-%m-%d') as data,
        DATE_FORMAT(horaInicioAgendada, '%H:%i') as horaInicio,
        DATE_FORMAT(fimAgendado, '%H:%i') as horaFim,
        nomePessoalAtribuido as instrutor,
        descricaoLocalizacaoAtribuida as local,
        confirmada as status
      FROM atividades
      WHERE id = ?`,
      [req.params.id]
    );

    if (atividade.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Atividade não encontrada'
      });
    }

    res.json({ success: true, data: atividade[0] });
  } catch (error) {
    log(`Erro ao buscar atividade: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor'
    });
  }
});

// Modificação de atividades apenas para admin
app.post('/api/atividades',
  requireAuth,
  checkRole(['admin']),
  async (req, res) => {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({
          success: false,
          error: 'O corpo da requisição deve ser um array de atividades'
        });
      }

      let inserted = 0;
      let skipped = 0;

      for (const atividade of req.body) {
        if (!atividade.descricao || !atividade.nomePessoalAtribuido) {
          continue;
        }

        const [existing] = await db.query(
          `SELECT id FROM atividades WHERE 
           descricao = ? AND 
           nomePessoalAtribuido = ? AND 
           datasAtividadeIndividual = ?`,
          [
            atividade.descricao,
            atividade.nomePessoalAtribuido,
            atividade.datasAtividadeIndividual || ''
          ]
        );

        if (existing.length === 0) {
          await db.query(
            `INSERT INTO atividades SET ?`,
            {
              descricao: atividade.descricao,
              nomePessoalAtribuido: atividade.nomePessoalAtribuido,
              horaInicioAgendada: atividade.horaInicioAgendada || null,
              fimAgendado: atividade.fimAgendado || null,
              datasAtividadeIndividual: atividade.datasAtividadeIndividual || null,
              descricaoLocalizacaoAtribuida: atividade.descricaoLocalizacaoAtribuida || null,
              confirmada: atividade.confirmada || 0
            }
          );
          inserted++;
        } else {
          skipped++;
        }
      }

      res.json({
        success: true,
        message: `Dados importados com sucesso (${inserted} inseridos, ${skipped} ignorados)`,
        inserted,
        skipped
      });
    } catch (error) {
      console.error('Erro ao importar atividades:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno no servidor'
      });
    }
  }
);

app.put('/api/atividades/:id',
  requireAuth,
  checkRole(['admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        descricao,
        nomePessoalAtribuido,
        horaInicioAgendada,
        fimAgendado,
        datasAtividadeIndividual,
        descricaoLocalizacaoAtribuida,
        confirmada
      } = req.body;

      // Validação básica
      if (!descricao || !nomePessoalAtribuido || !datasAtividadeIndividual || !horaInicioAgendada) {
        return res.status(400).json({
          success: false,
          error: 'Dados incompletos'
        });
      }

      const [result] = await db.query(
        `UPDATE atividades SET
          descricao = ?,
          nomePessoalAtribuido = ?,
          horaInicioAgendada = ?,
          fimAgendado = ?,
          datasAtividadeIndividual = ?,
          descricaoLocalizacaoAtribuida = ?,
          confirmada = ?
        WHERE id = ?`,
        [
          descricao,
          nomePessoalAtribuido,
          horaInicioAgendada,
          fimAgendado || null,
          datasAtividadeIndividual,
          descricaoLocalizacaoAtribuida || null,
          confirmada ? 1 : 0,
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
    } catch (error) {
      log(`Erro ao atualizar atividade: ${error.stack}`);
      res.status(500).json({
        success: false,
        error: 'Erro interno no servidor'
      });
    }
  }
);

app.delete('/api/atividades/:id',
  requireAuth,
  checkRole(['admin']),
  async (req, res) => {
    try {
      const [result] = await db.query(
        'DELETE FROM atividades WHERE id = ?',
        [req.params.id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Atividade não encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Atividade excluída com sucesso'
      });
    } catch (error) {
      log(`Erro ao excluir atividade: ${error.stack}`);
      res.status(500).json({
        success: false,
        error: 'Erro interno no servidor'
      });
    }
  }
);

// ROTA DE CONFIGURAÇÕES (acesso para todos autenticados)
app.get('/api/configuracoes', requireAuth, async (req, res) => {
  try {
    // Exemplo: retornar configurações básicas do sistema
    res.json({
      success: true,
      data: {
        nomeInstituicao: "Nome da Instituição",
        horarioFuncionamento: "08:00 às 18:00",
        contato: "contato@instituicao.com"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar configurações'
    });
  }
});

// Rota para upload de arquivos (apenas admin)
app.post('/api/upload',
  requireAuth,
  checkRole(['admin']),
  upload.single('arquivo'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo enviado'
        });
      }

      res.json({
        success: true,
        message: 'Arquivo recebido com sucesso',
        filename: req.file.filename
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao processar arquivo'
      });
    }
  }
);

// Tratamento para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada'
  });
});

// Tratamento global de erros
app.use((error, req, res, next) => {
  log(`Erro não tratado: ${error.stack}`);
  res.status(500).json({
    success: false,
    error: 'Erro interno no servidor'
  });
});

// Inicialização do servidor
app.listen(PORT, '0.0.0.0', () => {
  log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

// Tratamento de eventos não capturados
process.on('uncaughtException', (err) => {
  log(`🔥 ERRO GRAVE: ${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`⚠️ PROMISE REJEITADA: ${reason}`);
  log(`Promise: ${promise}`);
});