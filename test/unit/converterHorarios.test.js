import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import InserirPlanilha from '../inserirPlanilha';

// Mock das funções necessárias
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(() => ([
      { 'Nome': 'Aluno 1', 'Matrícula': '12345' },
      { 'Nome': 'Aluno 2', 'Matrícula': '67890' }
    ]))
  }
}));

describe('Componente InserirPlanilha', () => {
  beforeEach(() => {
    // Mock do FileReader
    global.FileReader = jest.fn(() => ({
      readAsArrayBuffer: jest.fn(),
      onload: jest.fn(),
      result: 'dummy-data'
    }));
  });

  test('renderiza corretamente', () => {
    render(<InserirPlanilha />);
    expect(screen.getByText('Importar Planilha')).toBeInTheDocument();
    expect(screen.getByLabelText('Selecione o arquivo')).toBeInTheDocument();
  });

  test('permite selecionar arquivo', () => {
    render(<InserirPlanilha />);
    const fileInput = screen.getByLabelText('Selecione o arquivo');
    
    const file = new File(['dummy content'], 'planilha.xlsx', { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    expect(fileInput.files[0].name).toBe('planilha.xlsx');
  });

  test('exibe mensagem de sucesso após upload', async () => {
    render(<InserirPlanilha />);
    const fileInput = screen.getByLabelText('Selecione o arquivo');
    
    const file = new File(['dummy content'], 'planilha.xlsx', { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Simula o processamento do arquivo
    await screen.findByText('2 registros importados com sucesso!');
  });
});