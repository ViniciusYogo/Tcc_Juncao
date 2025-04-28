document.addEventListener('DOMContentLoaded', function () {
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
      day: 'Dia',
      list: 'Lista'
    },
    eventDisplay: 'block', // Mostra todos os eventos como blocos
    eventOrder: 'start', // Ordena por horário de início
    eventOverlap: false, // Evita sobreposição
    slotEventOverlap: false, // Mostra todos os eventos mesmo que sobrepostos
    allDaySlot: false,
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
    slotDuration: '00:30:00',
    slotLabelInterval: '01:00:00',
    nowIndicator: true,
    navLinks: true,
    editable: true,
    dayMaxEvents: true,
    events: async function (fetchInfo, successCallback, failureCallback) {
      try {
        const start = fetchInfo.start.toISOString().split('T')[0];
        const end = fetchInfo.end.toISOString().split('T')[0];

        console.log(`Buscando aulas de ${start} até ${end}`);

        const response = await fetch(`http://localhost:5500/api/atividades?start=${start}&end=${end}`);

        if (!response.ok) {
          throw new Error(`Erro HTTP! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Total de aulas recebidas:', data.data.length); // Verifique a quantidade

        if (data.success) {
          console.log('Dados recebidos:', data.data); // Antes do map
          const events = data.data.map(aula => {
            // Verifique se os campos estão corretos
            if (!aula.data || !aula.horaInicio) {
              console.warn('Aula com dados incompletos:', aula);
              return null;
            }

            const startDateTime = `${aula.data}T${aula.horaInicio}:00`; // Adicione segundos
            const endDateTime = aula.horaFim ? `${aula.data}T${aula.horaFim}:00` : null;

            return {
              id: aula.id,
              title: `${aula.atividade} - ${aula.instrutor}`,
              start: startDateTime,
              end: endDateTime,
              extendedProps: {
                descricao: aula.atividade,
                instrutor: aula.instrutor,
                local: aula.local,
                status: aula.status
              },
              backgroundColor: aula.status ? '#28a745' : '#dc3545',
              borderColor: aula.status ? '#218838' : '#c82333',
              textColor: '#ffffff'
            };
          }).filter(event => event !== null); // Remove eventos inválidos

          console.log('Eventos processados:', events.length); // Verifique quantos eventos foram criados
          successCallback(events);
        } else {
          failureCallback(data.message || 'Erro ao carregar aulas');
        }
      } catch (error) {
        console.error('Erro ao carregar aulas:', error);
        failureCallback(error.message);
      }
    },
    eventClick: function (info) {
      const evento = info.event;
      const startDate = evento.start;

      abrirModalEdicao({
        id: evento.id,
        atividade: evento.extendedProps.descricao,
        instrutor: evento.extendedProps.instrutor,
        data: formatDate(startDate),
        horaInicio: formatTime(startDate),
        horaFim: evento.end ? formatTime(evento.end) : '',
        local: evento.extendedProps.local || '',
        status: evento.extendedProps.status || false
      });
    }
  });

  calendar.render();

  // Funções auxiliares para formatar data e hora
  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  function formatTime(date) {
    return date.toTimeString().substring(0, 5);
  }

  // Função para abrir modal de edição
  function abrirModalEdicao(aula) {
    const modal = document.getElementById('modalEdicao');

    document.getElementById('editDescricao').value = aula.atividade;
    document.getElementById('editProfessor').value = aula.instrutor;
    document.getElementById('editData').value = aula.data;
    document.getElementById('editHoraInicio').value = aula.horaInicio;
    document.getElementById('editHoraFim').value = aula.horaFim;
    document.getElementById('editLocal').value = aula.local;
    document.getElementById('editStatus').checked = aula.status;

    modal.dataset.eventId = aula.id;
    modal.style.display = 'block';
  }

  // Fechar modal
  document.querySelector('.close').addEventListener('click', function () {
    document.getElementById('modalEdicao').style.display = 'none';
  });

  document.querySelector('.botao-cancelar').addEventListener('click', function () {
    document.getElementById('modalEdicao').style.display = 'none';
  });

  window.addEventListener('click', function (event) {
    if (event.target === document.getElementById('modalEdicao')) {
      document.getElementById('modalEdicao').style.display = 'none';
    }
  });

  // Enviar formulário de edição
  document.getElementById('formEdicao').addEventListener('submit', async function (e) {
    e.preventDefault();

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

    try {
      const response = await fetch(`http://localhost:5500/api/atividades/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        calendar.refetchEvents();
        document.getElementById('modalEdicao').style.display = 'none';
      } else {
        throw new Error('Erro ao atualizar aula');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao atualizar aula: ' + error.message);
    }
  });
});