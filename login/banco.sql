CREATE DATABASE IF NOT EXISTS instituicao;

USE sistema_tcc;

CREATE TABLE administrador (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    senha VARCHAR(100) NOT NULL
);

INSERT INTO administrador (email, senha) VALUES
('admin@senai.com', '1234');