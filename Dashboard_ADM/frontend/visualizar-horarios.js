document.addEventListener('DOMContentLoaded', function () {
  // Variáveis globais para armazenar os dados originais
  let todosEventos = [];
  let disciplinasUnicas = [];
  let instrutoresUnicos = [];
  let calendar;

  // Função para extrair valores únicos de uma propriedade
  function extrairValoresUnicos(eventos, propriedade) {
    const valores = eventos.map(e => e.extendedProps[propriedade] || e.extendedProps[propriedade.toLowerCase()]);
    return [...new Set(valores)].filter(Boolean).sort();
  }

  // Função para configurar a exportação de PDF
  function setupPDFExport() {
    const btnExport = document.getElementById('export-pdf');
    if (!btnExport) return;

    btnExport.addEventListener('click', async function () {
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
        loadingMessage.textContent = 'Preparando calendário para exportação...';
        document.body.appendChild(loadingMessage);

        // Mudar para visualização diária para melhor legibilidade
        calendar.changeView('timeGridDay');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Expandir todos os eventos
        const events = calendar.getEvents();
        events.forEach(event => {
          const el = event.el;
          if (el) {
            el.classList.add('fc-event-expanded');
            el.style.height = 'auto';
            el.style.whiteSpace = 'normal';
            el.style.overflow = 'visible';

            const content = el.querySelector('.fc-event-main');
            if (content) {
              content.style.whiteSpace = 'normal';
              content.style.overflow = 'visible';
            }
          }
        });

        calendar.updateSize();
        await new Promise(resolve => setTimeout(resolve, 800));

        // Captura o calendário como imagem
        const calendarEl = document.getElementById('calendar');
        const canvas = await html2canvas(calendarEl, {
          scale: 3,
          logging: true,
          useCORS: true,
          scrollX: 0,
          scrollY: -window.scrollY,
          ignoreElements: function (element) {
            return element.id === 'export-pdf';
          },
          onclone: function (clonedDoc) {
            const clonedEvents = clonedDoc.querySelectorAll('.fc-event');
            clonedEvents.forEach(el => {
              el.classList.add('fc-event-expanded');
              el.style.height = 'auto';
              el.style.whiteSpace = 'normal';
              el.style.overflow = 'visible';

              const content = el.querySelector('.fc-event-main');
              if (content) {
                content.style.whiteSpace = 'normal';
                content.style.overflow = 'visible';
              }
            });

            const exportBtn = clonedDoc.getElementById('export-pdf');
            if (exportBtn) exportBtn.style.display = 'none';
          }
        });

        document.body.removeChild(loadingMessage);

        // Configura o PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm'
        });

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

      } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        showToast('Erro ao gerar PDF. Verifique o console para detalhes.', 'error');
      } finally {
        // Restaura o estado original
        btn.innerHTML = originalText;
        btn.disabled = false;
        calendar.changeView('timeGridWeek');

        const events = calendar.getEvents();
        events.forEach(event => {
          const el = event.el;
          if (el) {
            el.classList.remove('fc-event-expanded');
            el.style.height = '';
            el.style.whiteSpace = '';
            el.style.overflow = '';

            const content = el.querySelector('.fc-event-main');
            if (content) {
              content.style.whiteSpace = '';
              content.style.overflow = '';
            }
          }
        });

        calendar.updateSize();
      }
    });
  }

  // Função para popular selects de filtro
  function popularFiltros() {
    const selectDisciplina = document.getElementById('filtroDisciplina');
    const selectInstrutor = document.getElementById('filtroInstrutor');

    if (!selectDisciplina || !selectInstrutor) return;

    while (selectDisciplina.options.length > 1) selectDisciplina.remove(1);
    while (selectInstrutor.options.length > 1) selectInstrutor.remove(1);

    disciplinasUnicas.forEach(disciplina => {
      const option = document.createElement('option');
      option.value = disciplina;
      option.textContent = disciplina;
      selectDisciplina.appendChild(option);
    });

    instrutoresUnicos.forEach(instrutor => {
      const option = document.createElement('option');
      option.value = instrutor;
      option.textContent = instrutor;
      selectInstrutor.appendChild(option);
    });
  }

  // Função para aplicar filtros
  function aplicarFiltros() {
    const filtroDisciplina = document.getElementById('filtroDisciplina')?.value;
    const filtroInstrutor = document.getElementById('filtroInstrutor')?.value;

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
    const filtroDisciplina = document.getElementById('filtroDisciplina');
    const filtroInstrutor = document.getElementById('filtroInstrutor');
    
    if (filtroDisciplina) filtroDisciplina.value = '';
    if (filtroInstrutor) filtroInstrutor.value = '';
    
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
    return status ? 
      '<span class="status-confirmada"><i class="fas fa-check-circle"></i> Confirmada</span>' : 
      '<span class="status-nao-confirmada"><i class="fas fa-times-circle"></i> Não confirmada</span>';
  }

  // Função para gerar cores baseadas na descrição
  function getColorFromDescription(description) {
    if (!description) return {
      backgroundColor: '#6c757d',
      borderColor: '#5a6268',
      textColor: '#ffffff'
    };

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

  // Função para configurar os botões de ação
  function setupActionButtons() {
    // Botão Editar
    const btnEditar = document.getElementById('btnEditar');
    if (btnEditar) {
      btnEditar.addEventListener('click', function() {
        const modalDetalhes = document.getElementById('modalDetalhes');
        const eventId = modalDetalhes.dataset.eventId;
        const evento = calendar.getEventById(eventId);

        if (evento) {
          document.getElementById('editDescricao').value = evento.extendedProps.descricao;
          document.getElementById('editProfessor').value = evento.extendedProps.instrutor;
          document.getElementById('editData').value = formatDate(evento.start);
          document.getElementById('editHoraInicio').value = formatTime(evento.start);
          document.getElementById('editHoraFim').value = evento.end ? formatTime(evento.end) : '';
          document.getElementById('editLocal').value = evento.extendedProps.local || '';
          document.getElementById('editStatus').checked = evento.extendedProps.status;

          modalDetalhes.style.display = 'none';
          document.getElementById('modalEdicao').style.display = 'block';
          document.getElementById('modalEdicao').dataset.eventId = eventId;
        }
      });
    }

    // Botão Excluir
    const btnExcluir = document.getElementById('btnExcluir');
    if (btnExcluir) {
      btnExcluir.addEventListener('click', async function() {
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
    }

    // Botão Fechar
    const btnFechar = document.getElementById('btnFechar');
    if (btnFechar) {
      btnFechar.addEventListener('click', function() {
        document.getElementById('modalDetalhes').style.display = 'none';
      });
    }

    // Botão Cancelar na modal de edição
    const btnCancelar = document.querySelector('.botao-cancelar');
    if (btnCancelar) {
      btnCancelar.addEventListener('click', function() {
        document.getElementById('modalEdicao').style.display = 'none';
      });
    }

    // Fechar modais ao clicar no X
    document.querySelectorAll('.close').forEach(closeBtn => {
      closeBtn.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
      });
    });

    // Fechar modais ao clicar fora
    window.addEventListener('click', function(event) {
      if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
      }
    });
  }

  // Inicializa o calendário
  var calendarEl = document.getElementById('calendar');
  if (calendarEl) {
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
            const filtrosContainer = document.getElementById('filtrosContainer');
            if (filtrosContainer) {
              filtrosContainer.style.display =
                filtrosContainer.style.display === 'block' ? 'none' : 'block';
            }
          }
        }
      },
      buttonText: {
        today: 'Hoje',
        month: 'Mês',
        week: 'Semana',
        day: 'Dia'
      },
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
      eventContent: function (arg) {
        const evento = arg.event;
        const eventEl = document.createElement('div');
        eventEl.className = 'fc-event-content';

        const eventosSobrepostos = calendar.getEvents().filter(e =>
          e.id !== evento.id &&
          e.start < evento.end &&
          e.end > evento.start
        );

        const temSobreposicao = eventosSobrepostos.length > 0;

        if (temSobreposicao) {
          const totalEventos = eventosSobrepostos.length + 1;
          const eventosOrdenados = [...eventosSobrepostos, evento].sort((a, b) => a.id.localeCompare(b.id));
          const posicao = eventosOrdenados.findIndex(e => e.id === evento.id);

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

        // Adiciona classe conforme o status
        if (info.event.extendedProps.status) {
          eventEl.classList.add('evento-confirmado');
        } else {
          eventEl.classList.add('evento-nao-confirmado');
        }

        const elementos = eventEl.querySelectorAll('.fc-event-title, .fc-event-title-compact');
        elementos.forEach(el => {
          el.style.whiteSpace = 'nowrap';
          el.style.overflow = 'hidden';
          el.style.textOverflow = 'ellipsis';
        });

        eventEl.title = `${info.event.title}\n${info.timeText}\nLocal: ${info.event.extendedProps.local || 'Não especificado'}\nStatus: ${info.event.extendedProps.status ? 'Confirmada' : 'Não confirmada'}`;
        eventEl.style.height = 'auto';
        const contentHeight = eventEl.scrollHeight;
        eventEl.style.height = `${contentHeight}px`;
      },
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

            disciplinasUnicas = extrairValoresUnicos(todosEventos, 'descricao');
            instrutoresUnicos = extrairValoresUnicos(todosEventos, 'instrutor');

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
      eventClick: function (info) {
        const evento = info.event;

        document.getElementById('detalhesAtividade').textContent = evento.extendedProps.descricao;
        document.getElementById('detalhesInstrutor').textContent = evento.extendedProps.instrutor;
        document.getElementById('detalhesData').textContent = formatDate(evento.start);
        document.getElementById('detalhesHorario').textContent = `${formatTime(evento.start)} - ${evento.end ? formatTime(evento.end) : ''}`;
        document.getElementById('detalhesLocal').textContent = evento.extendedProps.local || 'Não especificado';
        document.getElementById('detalhesStatus').innerHTML = formatStatus(evento.extendedProps.status);

        const modalDetalhes = document.getElementById('modalDetalhes');
        if (modalDetalhes) {
          modalDetalhes.style.display = 'block';
          modalDetalhes.dataset.eventId = evento.id;
        }

        info.jsEvent.stopPropagation();
      }
    });

    calendar.render();
  }

  // Configura a exportação para PDF
  setupPDFExport();

  // Configura os botões de ação
  setupActionButtons();

  // Adiciona listeners para os filtros
  document.getElementById('btnAplicarFiltros')?.addEventListener('click', aplicarFiltros);
  document.getElementById('btnLimparFiltros')?.addEventListener('click', limparFiltros);

  document.getElementById('filtroDisciplina')?.addEventListener('change', aplicarFiltros);
  document.getElementById('filtroInstrutor')?.addEventListener('change', aplicarFiltros);

  // Enviar formulário de edição
  document.getElementById('formEdicao')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const btnSubmit = this.querySelector('button[type="submit"]');
    const btnOriginalText = btnSubmit.innerHTML;
    const eventId = document.getElementById('modalEdicao').dataset.eventId;

    try {
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      btnSubmit.disabled = true;

      // Preparar os dados para enviar
      const formData = {
        descricao: document.getElementById('editDescricao').value,
        nomePessoalAtribuido: document.getElementById('editProfessor').value,
        datasAtividadeIndividual: document.getElementById('editData').value,
        horaInicioAgendada: document.getElementById('editHoraInicio').value,
        fimAgendado: document.getElementById('editHoraFim').value || null,
        descricaoLocalizacaoAtribuida: document.getElementById('editLocal').value || null,
        confirmada: document.getElementById('editStatus').checked ? 1 : 0 // 1 para confirmada, 0 para não confirmada
      };

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

        // Atualiza visualmente o status
        const eventEl = evento.el;
        if (eventEl) {
          eventEl.classList.remove('evento-confirmado', 'evento-nao-confirmado');
          if (formData.confirmada === 1) {
            eventEl.classList.add('evento-confirmado');
          } else {
            eventEl.classList.add('evento-nao-confirmado');
          }
        }
      }

      // Fechar o modal
      document.getElementById('modalEdicao').style.display = 'none';
      showToast('Atividade atualizada com sucesso!');

    } catch (error) {
      console.error('Erro detalhado:', error);
      showToast(`Erro ao salvar: ${error.message}`, 'error');
      calendar.refetchEvents();
    } finally {
      btnSubmit.innerHTML = btnOriginalText;
      btnSubmit.disabled = false;
    }
  });

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