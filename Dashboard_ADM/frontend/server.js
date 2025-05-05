const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const app = express();
const PORT = 5500;
const bcrypt = require('bcryptjs');


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
app.put('/api/atividades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Dados recebidos:', req.body); // DEBUG

    const conn = await dbInstituicao.getConnection();

    try {
      const [result] = await conn.query(
        `UPDATE atividades SET
          descricao = ?,
          nomePessoalAtribuido = ?,
          datasAtividadeIndividual = ?,
          horaInicioAgendada = ?,
          fimAgendado = ?,
          descricaoLocalizacaoAtribuida = ?,
          confirmada = ?
        WHERE id = ?`,
        [
          req.body.descricao,
          req.body.nomePessoalAtribuido,
          req.body.datasAtividadeIndividual,
          req.body.horaInicioAgendada,
          req.body.fimAgendado,
          req.body.descricaoLocalizacaoAtribuida,
          req.body.confirmada,
          id
        ]
      );

      console.log('Resultado da atualização:', result); // DEBUG

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
    console.error('Erro detalhado:', error); // DEBUG
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


// Rota de criação de colaborador 
app.post('/api/criar-colaborador', async (req, res) => {
  try {
    const { primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, senha, fotoBase64 } = req.body;

    // Debug: Verifique se a foto está sendo recebida
    console.log('Foto recebida?', !!fotoBase64);
    
    // Processar a foto se existir
    let fotoBuffer = null;
    
    if (fotoBase64 && fotoBase64.startsWith('data:image')) {
      try {
        // Extrai apenas os dados base64 (remove o prefixo data:image/...)
        const base64Data = fotoBase64.split(',')[1];
        fotoBuffer = Buffer.from(base64Data, 'base64');

        // Debug: Verifique o tamanho do buffer
        console.log('Tamanho da imagem (bytes):', fotoBuffer.length);
        
        // Validação do tamanho (5MB)
        if (fotoBuffer.length > 5 * 1024 * 1024) {
          throw new Error('A imagem deve ter no máximo 5MB');
        }
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        return res.status(400).json({
          success: false,
          error: 'Erro ao processar imagem',
          message: error.message
        });
      }
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Debug: Verifique os dados antes de inserir
    console.log('Dados para inserção:', {
      primeiro_nome,
      email,
      nome_usuario,
      temFoto: !!fotoBuffer
    });

    // Inserir no banco de dados
    const [result] = await dbInstituicao.query(
      `INSERT INTO colaboradores 
       (primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, senha, foto)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        primeiro_nome,
        ultimo_nome || null,
        numero_contato || null,
        email,
        nome_usuario,
        hashedPassword,
        fotoBuffer // Pode ser null se não houver foto
      ]
    );

    // Debug: Verifique o resultado da inserção
    console.log('Resultado da inserção:', result);

    res.json({
      success: true,
      message: 'Colaborador criado com sucesso!',
      id: result.insertId
    });

  } catch (error) {
    console.error('Erro completo:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Dados duplicados',
        message: 'Email ou nome de usuário já está em uso'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: error.message
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
    const [rows] = await dbInstituicao.query(
      'SELECT id, primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, foto FROM colaboradores WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Colaborador não encontrado' 
      });
    }

    const colaborador = rows[0];
    
    // Converter foto binária para base64 se existir
    if (colaborador.foto) {
      // Assume que é JPEG por padrão (você pode ajustar conforme necessário)
      colaborador.fotoBase64 = `data:image/jpeg;base64,${colaborador.foto.toString('base64')}`;
    }
    
    // Remover o buffer binário da resposta
    delete colaborador.foto;
    
    res.json({
      success: true,
      data: colaborador
    });
  } catch (err) {
    console.error('Erro ao buscar colaborador:', err);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao buscar colaborador',
      message: err.message 
    });
  }
});

app.put('/api/colaboradores/:id', async (req, res) => {
  try {
    const { primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, senha, foto } = req.body;

    await dbInstituicao.query(
      `UPDATE colaboradores SET 
       primeiro_nome = ?, ultimo_nome = ?, numero_contato = ?, 
       email = ?, nome_usuario = ?, senha = ?, foto = ?
       WHERE id = ?`,
      [primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, senha, foto, req.params.id]
    );

    res.json({ success: true, message: 'Colaborador atualizado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar colaborador' });
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

