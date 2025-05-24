/**
 * @jest-environment jsdom
 */
const { handleFile } = require('../../src/js/app');
const XLSX = require('xlsx');

// Mock do FileReader
class MockFileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
  }
  
  readAsArrayBuffer() {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: { result: new ArrayBuffer(8) } });
      }
    }, 0);
  }
}

global.FileReader = MockFileReader;

describe('handleFile', () => {
  beforeEach(() => {
    // Configuração do DOM
    document.body.innerHTML = `
      <input id="fileInput" type="file" />
      <button id="processButton">Processar Planilha</button>
      <div id="uploadFeedback"></div>
      <div id="output"></div>
    `;
    
    // Reset de mocks
    jest.clearAllMocks();
  });

  it('deve processar arquivo com múltiplas datas corretamente', async () => {
    // 1. Mock da planilha
    const mockWorkbook = {
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {
          '!ref': 'A1:G1',
          A1: { t: 's', v: 'Descrição' },
          B1: { t: 's', v: 'Nome do pessoal atribuído' },
          // ... outras células de cabeçalho
        }
      }
    };
    
    const mockJsonData = [{
      'Descrição': 'Reunião de equipe',
      'Nome do pessoal atribuído': 'João Silva',
      'Dias agendados': '1',
      'Hora de início agendada': 0.5, // 12:00
      'Fim Agendado': 0.541666667, // 13:00
      'Datas da atividade (Individual)': '01/01/2023;02/01/2023',
      'Descrição da localização atribuída': 'Sala 101'
    }];
    
    // 2. Mock das funções do XLSX
    jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook);
    jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockJsonData);
    
    // 3. Simular seleção de arquivo
    const fileInput = document.getElementById('fileInput');
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['dummy content'], 'test.xlsx')]
    });
    
    // 4. Executar a função
    await handleFile();
    
    // 5. Verificações
    const outputDiv = document.getElementById('output');
    expect(outputDiv.innerHTML).toContain('Reunião de equipe');
    expect(outputDiv.innerHTML).toContain('João Silva');
    expect(outputDiv.innerHTML).toContain('2023-01-01');
    expect(outputDiv.innerHTML).toContain('2023-01-02');
    expect(outputDiv.innerHTML).toContain('12:00:00');
    expect(outputDiv.innerHTML).toContain('13:00:00');
    
    // Verifica se o botão foi reativado após o processamento
    const processButton = document.getElementById('processButton');
    expect(processButton.disabled).toBe(false);
    expect(processButton.textContent).toBe('Processar Planilha');
  });

  it('deve exibir mensagem de erro quando o processamento falhar', async () => {
    // Mock para simular erro
    jest.spyOn(XLSX, 'read').mockImplementation(() => {
      throw new Error('Formato de arquivo inválido');
    });
    
    // Simular seleção de arquivo
    const fileInput = document.getElementById('fileInput');
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['dummy content'], 'test.xlsx')]
    });
    
    // Executar a função
    await handleFile();
    
    // Verificar feedback de erro
    const feedbackDiv = document.getElementById('uploadFeedback');
    expect(feedbackDiv.textContent).toContain('Erro ao processar o arquivo');
    expect(feedbackDiv.className).toContain('upload-error');
  });
});