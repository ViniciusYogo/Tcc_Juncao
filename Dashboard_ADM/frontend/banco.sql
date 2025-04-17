CREATE DATABASE IF NOT EXISTS empresa;
USE empresa;

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


SELECT * FROM 	colaboradores;

INSERT INTO colaboradores (primeiro_nome, ultimo_nome, numero_contato, email, nome_usuario, senha, foto)
VALUES ('teste', 'sobrenome', '123', 'teste@exemplo.com', 'usuario', '1234', 'foto.jpg');

