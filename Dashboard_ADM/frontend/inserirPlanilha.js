document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const processButton = document.getElementById('processButton');
    const fileNameDisplay = document.getElementById('fileName');
    const feedbackDiv = document.getElementById('uploadFeedback');

    // Mostra o nome do arquivo selecionado
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            fileNameDisplay.textContent = this.files[0].name;
            processButton.disabled = false;
            feedbackDiv.style.display = 'none';
        } else {
            fileNameDisplay.textContent = '';
            processButton.disabled = true;
        }
    });

    processButton.addEventListener('click', handleFile);
});

function showFeedback(message, type) {
    const feedbackDiv = document.getElementById('uploadFeedback');
    feedbackDiv.textContent = message;
    feedbackDiv.className = `upload-feedback upload-${type}`;
    feedbackDiv.style.display = 'block';
}

// Função para converter horário decimal do Excel para formato HH:MM
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

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

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
                    datasAtividadeIndividual: data, // Apenas uma data por registro
                    descricaoLocalizacaoAtribuida: item['Descrição da localização atribuída'] || ''
                }));
            });

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

    atividades.forEach(atividade => {
        const div = document.createElement('div');
        div.className = 'atividade';
        div.innerHTML = `
            <p><strong>Descrição:</strong> ${atividade.descricao}</p>
            <p><strong>Nome:</strong> ${atividade.nomePessoalAtribuido}</p>
            <p><strong>Início:</strong> ${atividade.horaInicioAgendada}</p>
            <p><strong>Fim:</strong> ${atividade.fimAgendado}</p>
            <p><strong>Data:</strong> ${atividade.datasAtividadeIndividual || 'Nenhuma data especificada'}</p>
        `;
        outputDiv.appendChild(div);
    });
}

function sendDataToServer(atividades) {
    // Verifique se há atividades antes de enviar
    if (!atividades || atividades.length === 0) {
        showFeedback('Nenhum dado válido para enviar.', 'error');
        return;
    }

    fetch('http://localhost:5500/api/atividades', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(atividades),
    })
    .then(response => {
        if (!response.ok) {
            // Captura mais detalhes do erro
            return response.text().then(text => {
                throw new Error(`Status: ${response.status} - ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Sucesso:', data);
        showFeedback('Dados enviados com sucesso para o banco de dados!', 'success');
    })
    .catch(error => {
        console.error('Erro completo:', error);
        showFeedback(`Falha ao enviar dados: ${error.message}`, 'error');
    });
}