// Configurações globais
const diasDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const HORA_INICIO = 7;
const ALTURA_HORA = 70; // Aumentado para cards maiores
let dataReferencia = new Date();
let atividadeSelecionada = null;

// Cores para as matérias
const CORES_MATERIAS = [
  '#FFD1DC', '#B5EAD7', '#C7CEEA', '#E2F0CB', '#FFDAC1',
  '#F8B195', '#F67280', '#C06C84', '#6C5B7B', '#355C7D',
  '#A8E6CE', '#DCEDC2', '#FFD3B5', '#FFAAA6', '#FF8C94',
  '#A2D7D8', '#BCC4DB', '#C1BBDD', '#D4A5A5', '#E0BBE4'
];

// Funções utilitárias
function getCorParaMateria(nome) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CORES_MATERIAS[Math.abs(hash) % CORES_MATERIAS.length];
}

function escurecerCor(cor, percentual) {
  const num = parseInt(cor.replace('#', ''), 16);
  const amt = Math.round(2.55 * percentual);
  const R = Math.max(0, Math.min(255, (num >> 16) - amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) - amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) - amt));
  return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
}

function calcularPosicaoEvento(inicio, fim) {
  const inicioDecimal = inicio.getHours() + (inicio.getMinutes() / 60);
  const fimDecimal = fim.getHours() + (fim.getMinutes() / 60);
  return {
    top: (inicioDecimal - HORA_INICIO) * ALTURA_HORA,
    height: (fimDecimal - inicioDecimal) * ALTURA_HORA
  };
}

function processarDatas(datasString) {
  if (!datasString) return [];
  
  if (Array.isArray(datasString)) {
    return datasString.map(d => {
      if (d instanceof Date) {
        // Ajusta para o fuso horário local
        const date = new Date(d);
        return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
      }
      const parsedDate = new Date(d);
      if (isNaN(parsedDate.getTime())) return null;
      // Ajusta para o fuso horário local
      return new Date(parsedDate.getTime() + parsedDate.getTimezoneOffset() * 60000);
    }).filter(d => d !== null);
  }
  
  if (typeof datasString === 'string') {
    return datasString.split(';')
      .map(d => d.trim())
      .filter(d => d)
      .map(d => {
        const parsedDate = new Date(d);
        if (isNaN(parsedDate.getTime())) return null;
        // Ajusta para o fuso horário local
        return new Date(parsedDate.getTime() + parsedDate.getTimezoneOffset() * 60000);
      })
      .filter(d => d !== null);
  }
  
  return [];
}
function parseHora(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return null;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d;
}

function formatarHora(timeStr) {
  return timeStr ? timeStr.substring(0, 5) : '';
}

// Funções do calendário
function organizarEventos(diaElement) {
  const eventos = Array.from(diaElement.querySelectorAll('.evento'));
  eventos.sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top));
  
  let grupos = [], grupoAtual = [], ultimoFim = 0;
  
  eventos.forEach((e, i) => {
    const top = parseFloat(e.style.top);
    const height = parseFloat(e.style.height);
    const fim = top + height;
    
    if (top >= ultimoFim) {
      if (grupoAtual.length) grupos.push(grupoAtual);
      grupoAtual = [e];
      ultimoFim = fim;
    } else {
      grupoAtual.push(e);
      ultimoFim = Math.max(ultimoFim, fim);
    }
    
    if (i === eventos.length - 1) grupos.push(grupoAtual);
  });
  
  grupos.forEach(g => {
    const largura = 90 / g.length;
    g.forEach((e, i) => {
      e.style.width = `${largura}%`;
      e.style.left = `${5 + (i * largura)}%`;
      e.style.zIndex = i + 1;
    });
  });
}

function criarEvento(aula, diaElement) {
  const inicio = parseHora(aula.horaInicioAgendada);
  const fim = parseHora(aula.fimAgendado);
  if (!inicio || !fim) return null;

  const { top, height } = calcularPosicaoEvento(inicio, fim);
  const cor = getCorParaMateria(aula.descricao);

  const evento = document.createElement('div');
  evento.className = `evento ${aula.confirmada ? 'confirmado' : ''}`;
  evento.dataset.id = aula.id;
  evento.style.cssText = `
    top: ${top}px;
    height: ${height}px;
    background-color: ${cor};
    border-left: 4px solid ${escurecerCor(cor, 20)};
    position: relative;
    padding: 10px;
    font-size: 14px;
    min-height: ${ALTURA_HORA}px;
    box-sizing: border-box;
    overflow: hidden;
    transition: all 0.2s ease;
  `;

  // Adiciona botão de check
  const checkBtn = document.createElement('button');
  checkBtn.className = `check-btn ${aula.confirmada ? 'checked' : ''}`;
  checkBtn.innerHTML = '✓';
  checkBtn.title = aula.confirmada ? 'Aula confirmada' : 'Confirmar aula';
  checkBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const wasConfirmed = checkBtn.classList.contains('checked');

    try {
      const response = await fetch(`http://localhost:5500/api/atividades/${aula.id}/confirmar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmada: !wasConfirmed
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar status');
      }

      checkBtn.classList.toggle('checked');
      evento.classList.toggle('confirmado');
      checkBtn.title = checkBtn.classList.contains('checked') ? 'Aula confirmada' : 'Confirmar aula';
    } catch (error) {
      console.error('Erro ao confirmar aula:', error);
    }
  });

  evento.innerHTML = `
    <p class="titulo" style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">${aula.descricao}</p>
    <p class="horario" style="font-size: 14px; margin-bottom: 3px;">${formatarHora(aula.horaInicioAgendada)} - ${formatarHora(aula.fimAgendado)}</p>
    <p class="professor" style="font-size: 14px; font-style: italic;">${aula.nomePessoalAtribuido}</p>
  `;

  evento.appendChild(checkBtn);

  evento.addEventListener('click', (e) => {
    if (e.target !== checkBtn) {
      e.stopPropagation();
      mostrarModal(aula);
    }
  });

  return evento;
}

async function carregarAtividades() {
  try {
    console.log('Iniciando carregamento de atividades...');
    const response = await fetch('http://localhost:5500/api/atividades');
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    const atividades = await response.json();
    console.log('Atividades recebidas:', atividades);

    // Limpa todos os eventos existentes
    document.querySelectorAll('.eventos').forEach(e => e.innerHTML = '');

    // Obtém a semana atual baseada na dataReferencia
    const diaSemanaRef = dataReferencia.getDay();
    const diff = dataReferencia.getDate() - diaSemanaRef + (diaSemanaRef === 0 ? -6 : 1);
    const segunda = new Date(dataReferencia);
    segunda.setDate(diff);

    // Cria um array com as datas da semana atual
    const datasDaSemana = [];
    for (let i = 0; i < 6; i++) {
      const data = new Date(segunda);
      data.setDate(segunda.getDate() + i);
      datasDaSemana.push(data);
    }
    console.log('Datas da semana atual:', datasDaSemana);

    // Processa cada atividade
    atividades.forEach(a => {
      console.log(`Processando atividade: ${a.descricao}`);
      const datasProcessadas = processarDatas(a.datasAtividadeIndividual);
      console.log(`Datas processadas para ${a.descricao}:`, datasProcessadas);
      
      datasProcessadas.forEach(d => {
        try {
          console.log(`Verificando data: ${d}`);
          const dataAtividade = new Date(d);
          if (isNaN(dataAtividade.getTime())) {
            console.log('Data inválida:', d);
            return;
          }

          // Verifica se a data da atividade está na semana atual
          const dataNaSemana = datasDaSemana.some(dataSemana =>
            dataSemana.getDate() === dataAtividade.getDate() &&
            dataSemana.getMonth() === dataAtividade.getMonth() &&
            dataSemana.getFullYear() === dataAtividade.getFullYear()
          );

          if (dataNaSemana) {
            console.log(`Atividade ${a.descricao} está na semana atual`);
            const diaSemana = dataAtividade.getDay();
            console.log(`Dia da semana: ${diaSemana} (${diasDaSemana[diaSemana]})`);
            const diaElement = document.querySelector(`.dia.${diasDaSemana[diaSemana]}`);
            if (!diaElement) {
              console.log('Elemento do dia não encontrado');
              return;
            }

            const evento = criarEvento(a, diaElement);
            if (evento) {
              diaElement.querySelector('.eventos').appendChild(evento);
              console.log(`Evento criado para ${a.descricao}`);
            }
          } else {
            console.log(`Atividade ${a.descricao} não está na semana atual`);
          }
        } catch (e) {
          console.error('Erro ao processar atividade:', e);
        }
      });
    });

    // Organiza os eventos em cada dia
    document.querySelectorAll('.dia').forEach(organizarEventos);
  } catch (error) {
    console.error('Erro ao carregar atividades:', error);
    alert('Erro ao carregar horários. Recarregue a página.');
  }
}

function atualizarCalendario() {
  document.getElementById('mes-ano').textContent =
    `${meses[dataReferencia.getMonth()]} ${dataReferencia.getFullYear()}`;

  const diaSemana = dataReferencia.getDay();
  const diff = dataReferencia.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
  const segunda = new Date(dataReferencia);
  segunda.setDate(diff);

  const hoje = new Date();
  const hojeFormatado = hoje.toDateString();

  for (let i = 1; i <= 6; i++) {
    const data = new Date(segunda);
    data.setDate(segunda.getDate() + (i - 1));

    const diaElement = document.querySelector(`.dia.${diasDaSemana[i]}`);
    if (!diaElement) continue;

    const numero = diaElement.querySelector('.numero-data');
    if (numero) numero.textContent = data.getDate();

    const mes = diaElement.querySelector('.mes-data');
    if (mes) mes.textContent = (data.getDate() === 1 || i === 1) ? meses[data.getMonth()] : '';

    if (data.toDateString() === hojeFormatado) {
      diaElement.classList.add('hoje');
      const marcadorHoje = document.createElement('div');
      marcadorHoje.className = 'marcador-hoje';
      diaElement.querySelector('.data').appendChild(marcadorHoje);
    } else {
      diaElement.classList.remove('hoje');
      const marcadorExistente = diaElement.querySelector('.marcador-hoje');
      if (marcadorExistente) {
        marcadorExistente.remove();
      }
    }
  }

  carregarAtividades();
}

function configurarControles() {
  document.getElementById('semana-anterior').addEventListener('click', () => {
    dataReferencia.setDate(dataReferencia.getDate() - 7);
    atualizarCalendario();
  });

  document.getElementById('hoje').addEventListener('click', () => {
    dataReferencia = new Date();
    atualizarCalendario();
  });

  document.getElementById('proxima-semana').addEventListener('click', () => {
    dataReferencia.setDate(dataReferencia.getDate() + 7);
    atualizarCalendario();
  });
}

function mostrarModal(aula) {
  atividadeSelecionada = aula;
  const modal = document.getElementById('modalEdicao');

  document.getElementById('editDescricao').value = aula.descricao;
  document.getElementById('editProfessor').value = aula.nomePessoalAtribuido;
  document.getElementById('editHoraInicio').value = aula.horaInicioAgendada;
  document.getElementById('editHoraFim').value = aula.fimAgendado;

  const datasValidas = processarDatas(aula.datasAtividadeIndividual).filter(d => !isNaN(d.getTime()));
  if (datasValidas.length > 0) {
    // Ajusta a data para o fuso horário local
    const dataLocal = new Date(datasValidas[0]);
    dataLocal.setMinutes(dataLocal.getMinutes() - dataLocal.getTimezoneOffset());
    document.getElementById('editData').value = dataLocal.toISOString().slice(0, 10);
  } else {
    document.getElementById('editData').value = '';
  }

  modal.style.display = 'flex';
}

function configurarModal() {
  const modal = document.getElementById('modalEdicao');
  const formEdicao = document.getElementById('formEdicao');

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.id === 'btnCancelar') {
      modal.style.display = 'none';
    }
  });

  document.getElementById('btnSalvar').addEventListener('click', async () => {
    if (!formEdicao.checkValidity()) {
      alert('Preencha todos os campos corretamente!');
      return;
    }
  
    try {
      // Obtém a data do input e ajusta para o fuso horário correto
      const dataInput = document.getElementById('editData').value;
      const novaData = new Date(dataInput);
      
      // Ajusta para evitar problemas de fuso horário
      const dataAjustada = new Date(novaData.getTime() + novaData.getTimezoneOffset() * 60000);
      
      if (isNaN(dataAjustada.getTime())) {
        throw new Error('Data inválida');
      }
  
      const dadosAtualizados = {
        descricao: document.getElementById('editDescricao').value,
        nomePessoalAtribuido: document.getElementById('editProfessor').value,
        horaInicioAgendada: document.getElementById('editHoraInicio').value,
        fimAgendado: document.getElementById('editHoraFim').value,
        datasAtividadeIndividual: [dataAjustada.toISOString()]
      };
  
      const response = await fetch(`http://localhost:5500/api/atividades/${atividadeSelecionada.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dadosAtualizados)
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Falha ao atualizar' }));
        throw new Error(errorData.error || 'Falha ao atualizar');
      }
  
      const result = await response.json();
      
      // Fecha o modal
      modal.style.display = 'none';
      
      // Encontra o card específico e o remove
      const cardAntigo = document.querySelector(`.evento[data-id="${atividadeSelecionada.id}"]`);
      if (cardAntigo) {
        cardAntigo.remove();
      }
      
      // Adiciona o card atualizado no dia correto
      const dataAtividade = new Date(result.datasAtividadeIndividual);
      if (!isNaN(dataAtividade.getTime())) {
        const diaSemana = dataAtividade.getDay();
        const diaElement = document.querySelector(`.dia.${diasDaSemana[diaSemana]}`);
        if (diaElement) {
          const novoEvento = criarEvento(result, diaElement);
          if (novoEvento) {
            diaElement.querySelector('.eventos').appendChild(novoEvento);
            organizarEventos(diaElement);
          }
        }
      }
      
      alert('Atividade atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      alert(`Erro ao atualizar atividade: ${error.message}`);
    }
  });

  document.getElementById('btnExcluir').addEventListener('click', async () => {
    if (!confirm(`Tem certeza que deseja excluir "${atividadeSelecionada.descricao}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5500/api/atividades/${atividadeSelecionada.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Falha ao excluir' }));
        throw new Error(errorData.error || 'Falha ao excluir');
      }

      modal.style.display = 'none';
      await carregarAtividades();
      alert('Atividade excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert(`Erro ao excluir atividade: ${error.message}`);
    }
  });
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  configurarControles();
  configurarModal();
  atualizarCalendario();
});