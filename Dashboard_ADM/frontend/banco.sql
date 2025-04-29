CREATE database instituicao;

use instituicao;



CREATE TABLE atividades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    nomePessoalAtribuido VARCHAR(255) NOT NULL,
    diasAgendados VARCHAR(100),
    horaInicioAgendada TIME,
    fimAgendado TIME,
    datasAtividadeIndividual TEXT,
    descricaoLocalizacaoAtribuida VARCHAR(255),
    confirmada BOOLEAN DEFAULT FALSE
);


select * from atividades;



CREATE TABLE colaboradores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  primeiro_nome VARCHAR(100),
  ultimo_nome VARCHAR(100),
  numero_contato VARCHAR(20),
  email VARCHAR(100),
  nome_usuario VARCHAR(100),
  senha VARCHAR(100),
  foto VARCHAR(255)
);

ALTER TABLE colaboradores
ADD COLUMN turma VARCHAR(50) AFTER email,
ADD COLUMN sala VARCHAR(50) AFTER turma;

SELECT * FROM 	atividades;

INSERT INTO colaboradores (primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, senha, foto)
VALUES ('teste', 'sobrenome', '123', 'teste@exemplo.com', 'usuario', '1234', 'foto.jpg');

SELECT 
  id,
  descricao as atividade,
  DATE_FORMAT(datasAtividadeIndividual, '%Y-%m-%d') as data,
  DATE_FORMAT(horaInicioAgendada, '%H:%i') as hora,
  nomePessoalAtribuido as instrutor,
  descricaoLocalizacaoAtribuida as local,
  confirmada as status
FROM atividades;