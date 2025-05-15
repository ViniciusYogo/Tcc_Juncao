

document.addEventListener('DOMContentLoaded', function () {


  // Variáveis globais para armazenar os dados originais
  let todosEventos = [];
  let disciplinasUnicas = [];
  let instrutoresUnicos = [];
  let calendar; // Declaração única da variável calendar

  // Função para extrair valores únicos de uma propriedade
  function extrairValoresUnicos(eventos, propriedade) {
    const valores = eventos.map(e => e.extendedProps[propriedade] || e.extendedProps[propriedade.toLowerCase()]);
    return [...new Set(valores)].filter(Boolean).sort();
  }

  // Função para configurar a exportação de PDF (versão única e melhorada)
  function setupPDFExport() {
    document.getElementById('export-pdf').addEventListener('click', function () {
      const btn = this;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando PDF...';
      btn.disabled = true;

      try {
        // Mostra mensagem enquanto processa
        const loadingMessage = document.createElement('div');
        loadingMessage.style.position = 'fixed';
        loadingMessage.style.top = '50%';
        loadingMessage.style.left = '50%';
        loadingMessage.style.transform = 'translate(-50%, -50%)';
        loadingMessage.style.backgroundColor = 'rgba(0,0,0,0.7)';
        loadingMessage.style.color = 'white';
        loadingMessage.style.padding = '20px';
        loadingMessage.style.borderRadius = '5px';
        loadingMessage.style.zIndex = '9999';
        loadingMessage.textContent = 'Gerando PDF...';
        document.body.appendChild(loadingMessage);

        // Obtém o elemento do calendário
        const calendarEl = document.getElementById('calendar');

        // Configurações do html2canvas
        const options = {
          scale: 2, // Aumenta a qualidade
          logging: false,
          useCORS: true,
          scrollX: 0,
          scrollY: -window.scrollY,
          ignoreElements: function (element) {
            // Ignora o botão de exportação no PDF
            return element.id === 'export-pdf';
          }
        };

        // Captura o calendário como imagem
        html2canvas(calendarEl, options).then(canvas => {
          // Remove a mensagem de carregamento
          document.body.removeChild(loadingMessage);

          // Configura o PDF
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm'
          });

          // Adiciona a imagem ao PDF
          const imgData = canvas.toDataURL('image/png');
          const imgProps = pdf.getImageProperties(imgData);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

          // Adiciona título com a data atual
          const currentDate = new Date();
          const dateStr = currentDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          });

          pdf.setFontSize(22);
          pdf.setTextColor(40, 40, 40);
          pdf.text(`Agenda de Aulas - ${dateStr}`, 10, 15);

          // Salva o PDF
          pdf.save(`agenda_aulas_${currentDate.getTime()}.pdf`);

          // Restaura o botão
          btn.innerHTML = originalText;
          btn.disabled = false;
        }).catch(err => {
          console.error('Erro ao gerar PDF:', err);
          document.body.removeChild(loadingMessage);
          showToast('Ocorreu um erro ao gerar o PDF. Por favor, tente novamente.', 'error');
          btn.innerHTML = originalText;
          btn.disabled = false;
        });
      } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        showToast('Erro ao gerar PDF. Verifique o console para detalhes.', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  }



  // Função para popular selects de filtro
  function popularFiltros() {
    const selectDisciplina = document.getElementById('filtroDisciplina');
    const selectInstrutor = document.getElementById('filtroInstrutor');

    // Limpa opções existentes (mantendo a primeira)
    while (selectDisciplina.options.length > 1) selectDisciplina.remove(1);
    while (selectInstrutor.options.length > 1) selectInstrutor.remove(1);

    // Adiciona disciplinas
    disciplinasUnicas.forEach(disciplina => {
      const option = document.createElement('option');
      option.value = disciplina;
      option.textContent = disciplina;
      selectDisciplina.appendChild(option);
    });

    // Adiciona instrutores
    instrutoresUnicos.forEach(instrutor => {
      const option = document.createElement('option');
      option.value = instrutor;
      option.textContent = instrutor;
      selectInstrutor.appendChild(option);
    });
  }



  // Função para aplicar filtros
  function aplicarFiltros() {
    const filtroDisciplina = document.getElementById('filtroDisciplina').value;
    const filtroInstrutor = document.getElementById('filtroInstrutor').value;

    let eventosFiltrados = todosEventos;

    if (filtroDisciplina) {
      eventosFiltrados = eventosFiltrados.filter(evento =>
        evento.extendedProps.descricao === filtroDisciplina
      );
    }

    if (filtroInstrutor) {
      eventosFiltrados = eventosFiltrados.filter(evento =>
        evento.extendedProps.instrutor === filtroInstrutor
      );
    }

    calendar.removeAllEvents();
    calendar.addEventSource(eventosFiltrados);
  }

  // Função para limpar filtros
  function limparFiltros() {
    document.getElementById('filtroDisciplina').value = '';
    document.getElementById('filtroInstrutor').value = '';
    calendar.removeAllEvents();
    calendar.addEventSource(todosEventos);
  }

  // Funções auxiliares para formatação
  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  function formatTime(date) {
    return date.toTimeString().substring(0, 5);
  }

  function formatStatus(status) {
    return status ? 'Confirmada' : 'Não confirmada';
  }

  // Função para gerar cores baseadas na descrição
  function getColorFromDescription(description) {
    let hash = 0;
    for (let i = 0; i < description.length; i++) {
      hash = description.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const saturation = 70;
    const lightness = 50;
    const backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const borderColor = `hsl(${hue}, ${saturation}%, ${lightness - 10}%)`;
    const textColor = (lightness > 60 || (hue > 40 && hue < 200)) ? '#000000' : '#FFFFFF';
    return { backgroundColor, borderColor, textColor };
  }

  // Inicializa o calendário
  var calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'pt-br',
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'filtrosButton dayGridMonth,timeGridWeek,timeGridDay'
    },
    customButtons: {
      filtrosButton: {
        text: 'Filtros',
        click: function () {
          document.getElementById('filtrosContainer').style.display =
            document.getElementById('filtrosContainer').style.display === 'block' ? 'none' : 'block';
        }
      }
    },
    buttonText: {
      today: 'Hoje',
      month: 'Mês',
      week: 'Semana',
      day: 'Dia'
    },

    // Configurações de visualização
    views: {
      timeGridWeek: {
        eventMinHeight: 30,
        slotEventOverlap: false,
        dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'short' },
        slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
        allDaySlot: false
      },
      timeGridDay: {
        dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' },
        slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
        eventMinHeight: 30,
        slotEventOverlap: false
      }
    },

    // Configurações gerais
    eventDisplay: 'block',
    eventOrder: 'start',
    eventOverlap: false,
    slotEventOverlap: false,
    allDaySlot: false,
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
    slotDuration: '00:30:00',
    nowIndicator: true,
    navLinks: true,
    editable: false,
    dayMaxEvents: true,

    // Personalização dos eventos
    eventContent: function (arg) {
      const evento = arg.event;
      const eventEl = document.createElement('div');
      eventEl.className = 'fc-event-content';

      // Encontra eventos sobrepostos
      const eventosSobrepostos = calendar.getEvents().filter(e =>
        e.id !== evento.id &&
        e.start < evento.end &&
        e.end > evento.start
      );

      const temSobreposicao = eventosSobrepostos.length > 0;

      if (temSobreposicao) {
        // Calcula a posição e largura proporcional
        const totalEventos = eventosSobrepostos.length + 1;
        const eventosOrdenados = [...eventosSobrepostos, evento].sort((a, b) => a.id.localeCompare(b.id));
        const posicao = eventosOrdenados.findIndex(e => e.id === evento.id);

        // Aplica estilos para visualização compacta
        eventEl.style.width = `calc(${100 / totalEventos}% - 2px)`;
        eventEl.style.left = `calc(${posicao * (100 / totalEventos)}%)`;
        eventEl.style.zIndex = posicao + 1;
        eventEl.style.height = '100%';

        eventEl.innerHTML = `
          <div class="fc-event-compact">
            <div class="fc-event-title-compact">${evento.title.split(' - ')[0]}</div>
            <div class="fc-event-time-compact">${arg.timeText}</div>
          </div>
        `;
      } else {
        // Visualização normal quando não há sobreposição
        eventEl.innerHTML = `
          <div class="fc-event-title">${evento.title}</div>
          <div class="fc-event-time">${arg.timeText}</div>
          ${evento.extendedProps.local ? `<div class="fc-event-location">${evento.extendedProps.local}</div>` : ''}
        `;
      }

      return { domNodes: [eventEl] };
    },

    eventDidMount: function (info) {
      const eventEl = info.el;

      // Garante que o texto não ultrapasse os limites
      const elementos = eventEl.querySelectorAll('.fc-event-title, .fc-event-title-compact');
      elementos.forEach(el => {
        el.style.whiteSpace = 'nowrap';
        el.style.overflow = 'hidden';
        el.style.textOverflow = 'ellipsis';
      });

      // Tooltip com informações completas
      eventEl.title = `${info.event.title}\n${info.timeText}\nLocal: ${info.event.extendedProps.local || 'Não especificado'}`;

      // Ajusta altura para caber todo o conteúdo
      eventEl.style.height = 'auto';
      const contentHeight = eventEl.scrollHeight;
      eventEl.style.height = `${contentHeight}px`;
    },

    // Carregamento dos eventos
    events: async function (fetchInfo, successCallback, failureCallback) {
      try {
        const start = formatDate(fetchInfo.start);
        const end = formatDate(fetchInfo.end);

        const response = await fetch(`http://localhost:5500/api/atividades?start=${start}&end=${end}`);

        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

        const data = await response.json();

        if (data.success) {
          todosEventos = data.data.map(aula => {
            if (!aula.data || !aula.horaInicio) {
              console.warn('Aula incompleta:', aula);
              return null;
            }

            const cores = getColorFromDescription(aula.atividade);

            return {
              id: aula.id,
              title: `${aula.atividade} - ${aula.instrutor}`,
              start: `${aula.data}T${aula.horaInicio}`,
              end: aula.horaFim ? `${aula.data}T${aula.horaFim}` : null,
              extendedProps: {
                descricao: aula.atividade,
                instrutor: aula.instrutor,
                local: aula.local,
                status: aula.status
              },
              backgroundColor: cores.backgroundColor,
              borderColor: cores.borderColor,
              textColor: cores.textColor
            };
          }).filter(evento => evento !== null);

          // Extrai valores únicos para os filtros
          disciplinasUnicas = extrairValoresUnicos(todosEventos, 'descricao');
          instrutoresUnicos = extrairValoresUnicos(todosEventos, 'instrutor');

          // Popula os selects de filtro
          popularFiltros();

          successCallback(todosEventos);
        } else {
          throw new Error(data.message || 'Erro ao carregar aulas');
        }
      } catch (error) {
        console.error('Erro:', error);
        failureCallback(error.message);
      }
    },

    // Manipulação de eventos
    eventClick: function (info) {
      const evento = info.event;

      // Preenche a modal de detalhes
      document.getElementById('detalhesAtividade').textContent = evento.extendedProps.descricao;
      document.getElementById('detalhesInstrutor').textContent = evento.extendedProps.instrutor;
      document.getElementById('detalhesData').textContent = formatDate(evento.start);
      document.getElementById('detalhesHorario').textContent = `${formatTime(evento.start)} - ${evento.end ? formatTime(evento.end) : ''}`;
      document.getElementById('detalhesLocal').textContent = evento.extendedProps.local || 'Não especificado';
      document.getElementById('detalhesStatus').textContent = formatStatus(evento.extendedProps.status);

      // Mostra a modal de detalhes
      const modalDetalhes = document.getElementById('modalDetalhes');
      modalDetalhes.style.display = 'block';
      modalDetalhes.dataset.eventId = evento.id;

      info.jsEvent.stopPropagation();
    }
  });

  // Nova função para ajustar a altura das células
  function ajustarAlturaCalendario() {
    const calendarContainer = document.getElementById('calendar-container');
    const events = calendar.getEvents();

    // Conta eventos por dia
    const eventosPorDia = {};
    events.forEach(event => {
      if (event.start) {
        const dia = event.start.toISOString().split('T')[0];
        eventosPorDia[dia] = (eventosPorDia[dia] || 0) + 1;
      }
    });

    // Encontra o dia com mais eventos
    const maxEventosPorDia = Math.max(...Object.values(eventosPorDia), 0);

    // Aplica estilos conforme necessário
    if (maxEventosPorDia > 4) {
      calendarContainer.classList.add('expanded');

      // Marca dias com muitos eventos
      Object.keys(eventosPorDia).forEach(dia => {
        if (eventosPorDia[dia] > 3) {
          document.querySelectorAll(`[data-date="${dia}"]`).forEach(el => {
            el.classList.add('fc-day-many-events');
          });
        }
      });
    } else {
      calendarContainer.classList.remove('expanded');
      document.querySelectorAll('.fc-day-many-events').forEach(el => {
        el.classList.remove('fc-day-many-events');
      });
    }

    // Ajusta a altura da view
    const viewType = calendar.view.type;
    if (viewType === 'timeGridWeek' || viewType === 'timeGridDay') {
      const slotMinHeight = maxEventosPorDia > 3 ? '40px' : '30px';
      calendar.setOption('slotMinTime', '07:00:00');
      calendar.setOption('slotMaxTime', '22:00:00');
      calendar.setOption('slotDuration', '00:30:00');
      document.querySelectorAll('.fc-timegrid-slot').forEach(slot => {
        slot.style.height = slotMinHeight;
      });
    }
  }

  // Configura os listeners
  calendar.on('eventsSet', ajustarAlturaCalendario);
  calendar.on('viewDidMount', ajustarAlturaCalendario);
  window.addEventListener('resize', ajustarAlturaCalendario);

  // Chama inicialmente
  setTimeout(ajustarAlturaCalendario, 500);


  // Função melhorada para expandir o calendário

  function expandirCalendarioConformeNecessario() {
    const calendarContainer = document.getElementById('calendar-container');
    const events = calendar.getEvents();

    // Contar eventos por dia
    const eventosPorDia = {};
    events.forEach(event => {
      if (event.start) {
        const dateStr = event.start.toISOString().split('T')[0];
        eventosPorDia[dateStr] = (eventosPorDia[dateStr] || 0) + 1;
      }
    });

    // Verificar se precisa expandir
    const maxEventosPorDia = Math.max(...Object.values(eventosPorDia), 0);
    const precisaExpandir = maxEventosPorDia > 4;

    // Aplicar classes CSS
    calendarContainer.classList.toggle('expanded', precisaExpandir);

    // Marcar dias com muitos eventos
    document.querySelectorAll('.fc-day').forEach(dayEl => {
      const date = dayEl.getAttribute('data-date');
      dayEl.classList.toggle('fc-day-many-events', eventosPorDia[date] > 3);
    });

    // Ajustar altura das células
    ajustarAlturaCelulas();
  }




  // Renderiza o calendário
  calendar.render();

  // Configura a exportação para PDF após a inicialização do calendário
  setupPDFExport();

  // Configuração dos botões de ação
  document.getElementById('btnEditar').addEventListener('click', function () {
    const modalDetalhes = document.getElementById('modalDetalhes');
    const eventId = modalDetalhes.dataset.eventId;
    const evento = calendar.getEventById(eventId);

    if (evento) {
      // Preenche a modal de edição
      document.getElementById('editDescricao').value = evento.extendedProps.descricao;
      document.getElementById('editProfessor').value = evento.extendedProps.instrutor;
      document.getElementById('editData').value = formatDate(evento.start);
      document.getElementById('editHoraInicio').value = formatTime(evento.start);
      document.getElementById('editHoraFim').value = evento.end ? formatTime(evento.end) : '';
      document.getElementById('editLocal').value = evento.extendedProps.local || '';
      document.getElementById('editStatus').checked = evento.extendedProps.status;

      // Fecha a modal de detalhes e abre a de edição
      modalDetalhes.style.display = 'none';
      document.getElementById('modalEdicao').style.display = 'block';
      document.getElementById('modalEdicao').dataset.eventId = eventId;
    }
  });

  document.getElementById('btnExcluir').addEventListener('click', async function () {
    if (confirm('Tem certeza que deseja excluir esta atividade?')) {
      const modalDetalhes = document.getElementById('modalDetalhes');
      const eventId = modalDetalhes.dataset.eventId;

      try {
        const response = await fetch(`http://localhost:5500/api/atividades/${eventId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          calendar.getEventById(eventId).remove();
          modalDetalhes.style.display = 'none';
          showToast('Atividade excluída com sucesso!');
        } else {
          throw new Error('Erro ao excluir atividade');
        }
      } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao excluir atividade: ' + error.message, 'error');
      }
    }
  });

  // Fechar modais
  document.getElementById('btnFechar').addEventListener('click', function () {
    document.getElementById('modalDetalhes').style.display = 'none';
  });

  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function () {
      this.closest('.modal').style.display = 'none';
    });
  });

  window.addEventListener('click', function (event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  });

  // Enviar formulário de edição
  document.getElementById('formEdicao').addEventListener('submit', async function (e) {
    e.preventDefault();

    const btnSubmit = this.querySelector('button[type="submit"]');
    const btnOriginalText = btnSubmit.innerHTML;
    const eventId = document.getElementById('modalEdicao').dataset.eventId;

    try {
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      btnSubmit.disabled = true;

      // Preparar os dados para enviar (ajuste os nomes dos campos conforme seu banco)
      const formData = {
        descricao: document.getElementById('editDescricao').value,
        nomePessoalAtribuido: document.getElementById('editProfessor').value,
        datasAtividadeIndividual: document.getElementById('editData').value,
        horaInicioAgendada: document.getElementById('editHoraInicio').value,
        fimAgendado: document.getElementById('editHoraFim').value || null,
        descricaoLocalizacaoAtribuida: document.getElementById('editLocal').value || null,
        confirmada: document.getElementById('editStatus').checked ? 1 : 0 // Convertendo para inteiro (1 ou 0)
      };

      // DEBUG: Mostrar os dados que serão enviados
      console.log('Dados a serem enviados:', formData);

      // Enviar para o servidor
      const response = await fetch(`http://localhost:5500/api/atividades/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      // DEBUG: Mostrar a resposta do servidor
      const responseData = await response.json();
      console.log('Resposta do servidor:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || 'Erro ao atualizar atividade');
      }

      // Atualizar o evento no calendário
      const evento = calendar.getEventById(eventId);
      if (evento) {
        const novasCores = getColorFromDescription(formData.descricao);

        evento.setProp('title', `${formData.descricao} - ${formData.nomePessoalAtribuido}`);
        evento.setStart(`${formData.datasAtividadeIndividual}T${formData.horaInicioAgendada}`);
        evento.setEnd(formData.fimAgendado ? `${formData.datasAtividadeIndividual}T${formData.fimAgendado}` : null);
        evento.setExtendedProp('descricao', formData.descricao);
        evento.setExtendedProp('instrutor', formData.nomePessoalAtribuido);
        evento.setExtendedProp('local', formData.descricaoLocalizacaoAtribuida);
        evento.setExtendedProp('status', formData.confirmada);
        evento.setProp('backgroundColor', novasCores.backgroundColor);
        evento.setProp('borderColor', novasCores.borderColor);
        evento.setProp('textColor', novasCores.textColor);
      }

      // Fechar o modal
      document.getElementById('modalEdicao').style.display = 'none';
      showToast('Atividade atualizada com sucesso!');

    } catch (error) {
      console.error('Erro detalhado:', error);
      showToast(`Erro ao salvar: ${error.message}`, 'error');

      // Forçar recarregamento dos eventos do servidor
      calendar.refetchEvents();
    } finally {
      btnSubmit.innerHTML = btnOriginalText;
      btnSubmit.disabled = false;
    }
  });



  // Adiciona listeners para os filtros
  document.getElementById('btnAplicarFiltros').addEventListener('click', aplicarFiltros);
  document.getElementById('btnLimparFiltros').addEventListener('click', limparFiltros);

  // Opcional: aplicar filtros automaticamente ao mudar seleção
  document.getElementById('filtroDisciplina').addEventListener('change', aplicarFiltros);
  document.getElementById('filtroInstrutor').addEventListener('change', aplicarFiltros);

  // Função para mostrar notificações
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 3000);
    }, 100);
  }
});