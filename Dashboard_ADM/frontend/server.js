const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const fileupload = require('express-fileupload');
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

app.use(fileupload({
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'temp'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  abortOnLimit: true,
  responseOnLimit: 'O arquivo é muito grande (limite de 5MB)',
  safeFileNames: true,
  preserveExtension: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de logging
app.use((req, res, next) => {
  log(`📥 ${req.method} ${req.url}`);
  log(`Headers: ${JSON.stringify(req.headers)}`);
  next();
});

// Funções auxiliares para formatação de dados
function formatarDatas(dateString) {
  if (!dateString) return null;

  try {
    // Se for múltiplas datas separadas por ;
    if (typeof dateString === 'string' && dateString.includes(';')) {
      return dateString.split(';')
        .map(date => formatarDataIndividual(date.trim()))
        .filter(date => date)
        .join(';');
    }

    return formatarDataIndividual(dateString);
  } catch (e) {
    console.error("Erro ao formatar data:", dateString, e);
    return null;
  }
}

function formatarDataIndividual(dateString) {
  if (!dateString) return null;

  try {
    // Formato DD/MM/YYYY
    if (typeof dateString === 'string' && dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = dateString.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Formato Excel (número serial)
    if (typeof dateString === 'number') {
      const date = xlsx.SSF.parse_date_code(dateString);
      return new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
    }

    // Tentar parsear como Date
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    return null;
  } catch (e) {
    console.error("Erro ao formatar data individual:", dateString, e);
    return null;
  }
}

function formatarHora(timeString) {
  if (!timeString) return null;

  try {
    // Formato HH:MM:SS
    if (typeof timeString === 'string' && timeString.match(/^\d{2}:\d{2}:\d{2}$/)) {
      return timeString;
    }

    // Formato HH:MM
    if (typeof timeString === 'string' && timeString.match(/^\d{2}:\d{2}$/)) {
      return `${timeString}:00`;
    }

    // Número decimal do Excel (fração do dia)
    if (typeof timeString === 'number') {
      const date = xlsx.SSF.parse_date_code(timeString);
      const hours = Math.floor(timeString * 24);
      const minutes = Math.floor((timeString * 24 - hours) * 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00'`;
    }

    return null;
  } catch (e) {
    console.error("Erro ao formatar hora:", timeString, e);
    return null;
  }
}

// Rotas de Atividades
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

      res.json({
        success: true,
        data: atividades
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    log(`Erro ao buscar atividades: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: error.message
    });
  }
});

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

// Rota para receber os dados já processados do cliente
app.post('/api/atividades', async (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'O corpo da requisição deve ser um array de atividades'
    });
  }

  try {
    const conn = await dbInstituicao.getConnection();
    let inserted = 0;
    let skipped = 0;

    try {
      for (const atividade of req.body) {
        // Validação básica
        if (!atividade.descricao || !atividade.nomePessoalAtribuido) {
          continue; // Pula registros inválidos
        }

        // Verifica se já existe
        const [existing] = await conn.query(
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
          await conn.query(
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
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Erro ao importar atividades:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: error.message
    });
  }
});

app.delete('/api/atividades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await dbInstituicao.getConnection();

    try {
      const [result] = await conn.query(
        'DELETE FROM atividades WHERE id = ?',
        [id]
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
    } finally {
      conn.release();
    }
  } catch (error) {
    log(`Erro ao excluir atividade: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor'
    });
  }
});

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

// Rotas de Colaboradores
app.post('/api/criar-colaborador', async (req, res) => {
  try {
    console.log('Dados do corpo:', req.body);
    console.log('Arquivo recebido:', req.files ? req.files.foto : null);

    // Extrai os campos do corpo
    const {
      primeiro_nome,
      ultimo_nome,
      numero_contato,
      email,
      nome_usuario,
      senha
    } = req.body;

    let foto = null;

    // Processa o upload da foto se existir
    if (req.files && req.files.foto) {
      const fotoFile = req.files.foto;
      const uploadDir = path.join(__dirname, 'uploads');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Gera um nome único para o arquivo
      const ext = path.extname(fotoFile.name);
      const fileName = `${Date.now()}${ext}`;
      const filePath = path.join(uploadDir, fileName);

      // Move o arquivo para o diretório de uploads
      await fotoFile.mv(filePath);
      foto = fileName;
    }

    // Verificação adicional da conexão com o banco
    if (!dbInstituicao) {
      throw new Error('Database connection not established');
    }

    const [result] = await dbInstituicao.query(
      `INSERT INTO colaboradores 
       (primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, senha, foto)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        primeiro_nome,
        ultimo_nome,
        numero_contato,
        email,
        nome_usuario,
        senha,
        foto
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Colaborador criado com sucesso!',
      id: result.insertId
    });

  } catch (err) {
    console.error('Erro detalhado:', err);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      details: process.env.NODE_ENV === 'development' ? {
        message: err.message,
        stack: err.stack,
        sqlMessage: err.sqlMessage
      } : undefined
    });
  }
});

app.get('/api/colaboradores', async (req, res) => {
  try {
    const [colaboradores] = await dbInstituicao.query(`
      SELECT 
        id,
        primeiro_nome,
        ultimo_nome,
        numero_contato,
        email,
        nome_usuario,
        foto
      FROM colaboradores
      ORDER BY primeiro_nome
    `);

    res.json(colaboradores.map(c => ({
      ...c,
      foto: c.foto ? `/uploads/${c.foto}` : null
    })));
  } catch (error) {
    log(`Erro ao buscar colaboradores: ${error.stack}`);
    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: error.message
    });
  }
});
app.get('/api/colaboradores/:id', async (req, res) => {
  try {
    const [rows] = await dbInstituicao.query('SELECT * FROM colaboradores WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Colaborador não encontrado' });

    const colaborador = rows[0];
    colaborador.foto = colaborador.foto ? `/uploads/${colaborador.foto}` : null;
    res.json(colaborador);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar colaborador' });
  }
});

app.put('/api/colaboradores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let foto = null;

    // Processa o upload da foto se existir
    if (req.files && req.files.foto) {
      const fotoFile = req.files.foto;
      const uploadDir = path.join(__dirname, 'uploads');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Gera um nome único para o arquivo
      const ext = path.extname(fotoFile.name);
      const fileName = `${Date.now()}${ext}`;
      const filePath = path.join(uploadDir, fileName);

      // Move o arquivo para o diretório de uploads
      await fotoFile.mv(filePath);
      foto = fileName;
    }

    // Extrai os campos do formulário
    const {
      primeiro_nome,
      ultimo_nome,
      numero_contato,
      email,
      nome_usuario,
      senha
    } = req.body;

    // Monta o objeto de atualização
    const updateData = {
      primeiro_nome,
      ultimo_nome,
      numero_contato,
      email,
      nome_usuario
    };

    // Só atualiza a senha se foi fornecida
    if (senha && senha.trim() !== '') {
      updateData.senha = senha;
    }

    // Só atualiza a foto se foi enviada uma nova
    if (foto) {
      updateData.foto = foto;
    }

    // Executa a atualização no banco de dados
    const [result] = await dbInstituicao.query(
      'UPDATE colaboradores SET ? WHERE id = ?',
      [updateData, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Colaborador não encontrado'
      });
    }

    // Busca os dados atualizados para retornar
    const [rows] = await dbInstituicao.query(
      'SELECT * FROM colaboradores WHERE id = ?',
      [id]
    );

    const colaborador = rows[0];
    if (colaborador.foto) {
      colaborador.foto = `/uploads/${colaborador.foto}`;
    }

    res.json({
      success: true,
      message: 'Colaborador atualizado com sucesso!',
      data: colaborador
    });

  } catch (err) {
    console.error('Erro ao atualizar colaborador:', err);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar colaborador',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.delete('/api/colaboradores/:id', async (req, res) => {
  try {
    const [result] = await dbInstituicao.query('DELETE FROM colaboradores WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Colaborador não encontrado' });
    }
    res.json({ success: true, message: 'Colaborador excluído com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir colaborador' });
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
});

process.on('unhandledRejection', (reason, promise) => {
  log(`⚠️ PROMISE REJEITADA: ${reason}`);
  log(`Promise: ${promise}`);
});

