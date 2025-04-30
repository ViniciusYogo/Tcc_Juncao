document.addEventListener('DOMContentLoaded', function() {
  // Funções auxiliares
  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  function formatTime(date) {
    return date.toTimeString().substring(0, 5);
  }

  // Inicializa o calendário
  var calendarEl = document.getElementById('calendar');
  var calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'pt-br',
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
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
    editable: true,
    dayMaxEvents: true,
    
    // Personalização dos eventos
    eventContent: function(arg) {
      const evento = arg.event;
      const eventEl = document.createElement('div');
      eventEl.className = 'fc-event-content';

      // Verifica eventos sobrepostos
      const eventosSobrepostos = calendar.getEvents().filter(e => 
        e.id !== evento.id && 
        e.start < evento.end && 
        e.end > evento.start
      );

      const temSobreposicao = eventosSobrepostos.length > 0;

      if (temSobreposicao) {
        // Versão compacta para eventos sobrepostos
        const numEventos = eventosSobrepostos.length + 1;
        const posicao = eventosSobrepostos.findIndex(e => e.id > evento.id) + 1 || 0;
        
        eventEl.style.width = `calc(${100/numEventos}% - 2px)`;
        eventEl.style.left = `calc(${100/numEventos}% * ${posicao})`;
        eventEl.style.zIndex = 1;
        
        eventEl.innerHTML = `
          <div class="fc-event-compact">
            <div class="fc-event-title-compact">${evento.title.split(' - ')[0]}</div>
            <div class="fc-event-time-compact">${arg.timeText}</div>
          </div>
        `;
      } else {
        // Versão normal para eventos sem sobreposição
        eventEl.innerHTML = `
          <div class="fc-event-title">${evento.title}</div>
          <div class="fc-event-time">${arg.timeText}</div>
          ${evento.extendedProps.local ? `<div class="fc-event-location">${evento.extendedProps.local}</div>` : ''}
        `;
      }
      
      return { domNodes: [eventEl] };
    },

    // Garante que o texto não ultrapasse os limites
    eventDidMount: function(info) {
      const elementos = info.el.querySelectorAll('.fc-event-title, .fc-event-title-compact');
      elementos.forEach(el => {
        el.style.whiteSpace = 'nowrap';
        el.style.overflow = 'hidden';
        el.style.textOverflow = 'ellipsis';
      });
      
      // Tooltip com informações completas
      info.el.title = `${info.event.title}\n${info.timeText}\nLocal: ${info.event.extendedProps.local || 'Não especificado'}`;
    },
    
    // Carregamento dos eventos
    events: async function(fetchInfo, successCallback, failureCallback) {
      try {
        const start = formatDate(fetchInfo.start);
        const end = formatDate(fetchInfo.end);
        
        const response = await fetch(`http://localhost:5500/api/atividades?start=${start}&end=${end}`);
        
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
          const eventos = data.data.map(aula => {
            if (!aula.data || !aula.horaInicio) {
              console.warn('Aula incompleta:', aula);
              return null;
            }
            
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
              backgroundColor: aula.status ? '#28a745' : '#dc3545',
              borderColor: aula.status ? '#218838' : '#c82333',
              textColor: '#fff'
            };
          }).filter(evento => evento !== null);
          
          successCallback(eventos);
        } else {
          throw new Error(data.message || 'Erro ao carregar aulas');
        }
      } catch (error) {
        console.error('Erro:', error);
        failureCallback(error.message);
      }
    },
    
    // Manipulação de eventos
    eventClick: function(info) {
      const evento = info.event;
      const modal = document.getElementById('modalEdicao');
      
      document.getElementById('editDescricao').value = evento.extendedProps.descricao;
      document.getElementById('editProfessor').value = evento.extendedProps.instrutor;
      document.getElementById('editData').value = formatDate(evento.start);
      document.getElementById('editHoraInicio').value = formatTime(evento.start);
      document.getElementById('editHoraFim').value = evento.end ? formatTime(evento.end) : '';
      document.getElementById('editLocal').value = evento.extendedProps.local || '';
      document.getElementById('editStatus').checked = evento.extendedProps.status;
      
      modal.dataset.eventId = evento.id;
      modal.style.display = 'block';
      
      info.jsEvent.stopPropagation();
    }
  });

  // Renderiza o calendário
  calendar.render();

  // Fechar modal
  document.querySelector('.close')?.addEventListener('click', function() {
    document.getElementById('modalEdicao').style.display = 'none';
  });

  document.querySelector('.botao-cancelar')?.addEventListener('click', function() {
    document.getElementById('modalEdicao').style.display = 'none';
  });

  window.addEventListener('click', function(event) {
    if (event.target === document.getElementById('modalEdicao')) {
      document.getElementById('modalEdicao').style.display = 'none';
    }
  });

  // Enviar formulário de edição
  document.getElementById('formEdicao')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btnSubmit = this.querySelector('button[type="submit"]');
    const btnOriginalText = btnSubmit.innerHTML;
    
    try {
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      btnSubmit.disabled = true;
      
      const eventId = document.getElementById('modalEdicao').dataset.eventId;
      const formData = {
        descricao: document.getElementById('editDescricao').value,
        nomePessoalAtribuido: document.getElementById('editProfessor').value,
        datasAtividadeIndividual: document.getElementById('editData').value,
        horaInicioAgendada: document.getElementById('editHoraInicio').value,
        fimAgendado: document.getElementById('editHoraFim').value,
        descricaoLocalizacaoAtribuida: document.getElementById('editLocal').value,
        confirmada: document.getElementById('editStatus').checked
      };
      
      const response = await fetch(`http://localhost:5500/api/atividades/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar');
      
      calendar.refetchEvents();
      document.getElementById('modalEdicao').style.display = 'none';
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao salvar: ' + error.message);
    } finally {
      btnSubmit.innerHTML = btnOriginalText;
      btnSubmit.disabled = false;
    }
  });
});