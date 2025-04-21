document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const processButton = document.getElementById('processButton');
    const fileNameDisplay = document.getElementById('fileName');
    const feedbackDiv = document.getElementById('uploadFeedback');

    // Verifica se todos elementos existem
    if (!form || !fileInput || !processButton || !fileNameDisplay || !feedbackDiv) {
        console.error('Elementos não encontrados! Verifique os IDs no HTML');
        return;
    }

    // Configura o evento change do input de arquivo
    fileInput.addEventListener('change', function() {
        console.log('Arquivo selecionado:', this.files);
        
        if (this.files && this.files.length > 0) {
            fileNameDisplay.textContent = this.files[0].name;
            processButton.disabled = false;
            feedbackDiv.style.display = 'none';
        } else {
            fileNameDisplay.textContent = '';
            processButton.disabled = true;
        }
    });

    // Configura o evento submit do formulário
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (fileInput.files.length > 0) {
            handleFile();
        }
    });
});

function showFeedback(message, type) {
    const feedbackDiv = document.getElementById('uploadFeedback');
    feedbackDiv.textContent = message;
    feedbackDiv.className = `upload-feedback upload-${type}`;
    feedbackDiv.style.display = 'block';
}

function converterHorarioExcel(valor) {
    if (valor === undefined || valor === null) return null;
    
    // Se já estiver no formato HH:MM, retorna direto
    if (typeof valor === 'string' && valor.includes(':')) {
        return valor;
    }
    
    // Converte para número
    const num = Number(valor);
    if (isNaN(num)) return null;
    
    // Calcula horas e minutos
    const horas = Math.floor(num * 24);
    const minutos = Math.round((num * 24 * 60) % 60);
    
    // Formata com dois dígitos
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:00`;
}

function handleFile() {
    const fileInput = document.getElementById('fileInput');
    const processButton = document.getElementById('processButton');
    const file = fileInput.files[0];

    if (!file) {
        showFeedback("Por favor, selecione um arquivo.", "error");
        return;
    }

    // Desabilita o botão durante o processamento
    processButton.disabled = true;
    processButton.textContent = 'Processando...';
    showFeedback("Processando planilha...", "info");

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            console.log("Iniciando processamento do arquivo...");
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            
            console.log("Dados extraídos:", jsonData);

            // Transforma os dados - cria um registro para cada data
            const atividades = jsonData.flatMap(item => {
                const datas = item['Datas da atividade (Individual)'] 
                    ? item['Datas da atividade (Individual)'].toString().split(';').map(d => d.trim())
                    : [];
                
                // Se não houver datas, retorna pelo menos um registro
                if (datas.length === 0) {
                    return [{
                        descricao: item.Descrição || '',
                        nomePessoalAtribuido: item['Nome do pessoal atribuído'] || '',
                        diasAgendados: item['Dias agendados'] || '',
                        horaInicioAgendada: converterHorarioExcel(item['Hora de início agendada']),
                        fimAgendado: converterHorarioExcel(item['Fim Agendado']),
                        datasAtividadeIndividual: '', // String vazia
                        descricaoLocalizacaoAtribuida: item['Descrição da localização atribuída'] || ''
                    }];
                }
                
                return datas.map(data => ({
                    descricao: item.Descrição || '',
                    nomePessoalAtribuido: item['Nome do pessoal atribuído'] || '',
                    diasAgendados: item['Dias agendados'] || '',
                    horaInicioAgendada: converterHorarioExcel(item['Hora de início agendada']),
                    fimAgendado: converterHorarioExcel(item['Fim Agendado']),
                    datasAtividadeIndividual: data,
                    descricaoLocalizacaoAtribuida: item['Descrição da localização atribuída'] || ''
                }));
            });

            console.log("Dados processados:", atividades);
            displayData(atividades);
            sendDataToServer(atividades);

        } catch (error) {
            console.error('Erro ao processar arquivo:', error);
            showFeedback('Erro ao processar o arquivo: ' + error.message, 'error');
        } finally {
            processButton.disabled = false;
            processButton.textContent = 'Processar Planilha';
        }
    };

    reader.onerror = function() {
        showFeedback('Erro ao ler o arquivo.', 'error');
        processButton.disabled = false;
        processButton.textContent = 'Processar Planilha';
    };

    reader.readAsArrayBuffer(file);
}

function displayData(atividades) {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '';

    if (!atividades || atividades.length === 0) {
        outputDiv.innerHTML = '<div class="atividade">Nenhum dado encontrado na planilha.</div>';
        return;
    }

    atividades.forEach(atividade => {
        const div = document.createElement('div');
        div.className = 'atividade';
        div.innerHTML = `
            <p><strong>Descrição:</strong> ${atividade.descricao}</p>
            <p><strong>Nome:</strong> ${atividade.nomePessoalAtribuido}</p>
            <p><strong>Dias:</strong> ${atividade.diasAgendados}</p>
            <p><strong>Início:</strong> ${atividade.horaInicioAgendada || 'Não especificado'}</p>
            <p><strong>Fim:</strong> ${atividade.fimAgendado || 'Não especificado'}</p>
            <p><strong>Data:</strong> ${atividade.datasAtividadeIndividual || 'Nenhuma data especificada'}</p>
            <p><strong>Localização:</strong> ${atividade.descricaoLocalizacaoAtribuida || 'Não especificada'}</p>
        `;
        outputDiv.appendChild(div);
    });
}

function sendDataToServer(atividades) {
    if (!atividades || atividades.length === 0) {
        showFeedback('Nenhum dado válido para enviar.', 'error');
        return;
    }

    console.log('Enviando dados para o servidor:', atividades);
    showFeedback('Enviando dados para o servidor...', 'info');

    fetch('http://localhost:5500/api/atividades', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(atividades),
    })
    .then(async response => {
        const data = await response.json();
        
        if (!response.ok) {
            let errorMsg = `Erro ${response.status}`;
            if (data && data.error) errorMsg += `: ${data.error}`;
            if (data && data.errorsList) errorMsg += `\nErros detalhados:\n${data.errorsList.join('\n')}`;
            
            throw new Error(errorMsg);
        }
        
        return data;
    })
    .then(data => {
        console.log('Resposta do servidor:', data);
        let message = 'Dados enviados com sucesso!';
        if (data.inserted) message += `\nRegistros inseridos: ${data.inserted}`;
        if (data.errors) message += `\nRegistros com erro: ${data.errors}`;
        
        showFeedback(message, 'success');
        
        if (data.errorsList && data.errorsList.length > 0) {
            const errorDetails = document.createElement('div');
            errorDetails.className = 'error-details';
            errorDetails.innerHTML = `<h4>Erros detalhados:</h4><ul>${
                data.errorsList.map(e => `<li>${e}</li>`).join('')
            }</ul>`;
            document.getElementById('output').appendChild(errorDetails);
        }
    })
    .catch(error => {
        console.error('Erro ao enviar dados:', error);
        showFeedback(`Falha ao enviar dados: ${error.message}`, 'error');
    });
}

function initializeUploadForm() {
    console.log('Inicializando formulário de upload...');
    
    const fileInput = document.getElementById('fileInput');
    const processButton = document.getElementById('processButton');
    const fileNameDisplay = document.getElementById('fileName');
    
    if (!fileInput || !processButton || !fileNameDisplay) {
        console.error('Elementos não encontrados! Verifique os IDs:',
            { fileInput, processButton, fileNameDisplay });
        return;
    }

    fileInput.addEventListener('change', function() {
        console.log('Evento change disparado');
        
        if (this.files && this.files.length > 0) {
            console.log('Arquivo selecionado:', this.files[0].name);
            fileNameDisplay.textContent = this.files[0].name;
            processButton.disabled = false;
        } else {
            console.log('Nenhum arquivo selecionado ou seleção cancelada');
            fileNameDisplay.textContent = '';
            processButton.disabled = true;
        }
    });

    document.getElementById('uploadForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (fileInput.files.length > 0) {
            handleFile();
        }
    });
}

// Aguarda o DOM estar totalmente carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUploadForm);
} else {
    initializeUploadForm();
}