document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');
  
  const calendar = new FullCalendar.Calendar(calendarEl, {
    // ... outras configurações ...
    
    events: async function(fetchInfo, successCallback, failureCallback) {
      try {
        console.log('Carregando eventos...');
        const response = await fetch(`http://localhost:5500/api/atividades`);
        
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        const resposta = await response.json();
        console.log('Resposta da API:', resposta);

        // Tratamento para diferentes formatos de resposta
        let atividades = [];
        
        if (Array.isArray(resposta)) {
          atividades = resposta;
        } else if (resposta.data && Array.isArray(resposta.data)) {
          atividades = resposta.data;
        } else if (typeof resposta === 'object' && resposta !== null) {
          // Se for um único objeto, transforma em array
          atividades = [resposta];
        } else {
          throw new Error('Formato de dados inválido da API');
        }

        console.log('Atividades processadas:', atividades);

        const eventos = atividades.map(atividade => {
          try {
            if (!atividade) return null;
            
            const dataEvento = atividade.datasAtividadeIndividual || atividade.data;
            const horaInicio = atividade.horaInicioAgendada || atividade.horaInicio;
            
            if (!dataEvento || !horaInicio) {
              console.warn('Atividade incompleta:', atividade);
              return null;
            }

            const startDateTime = `${dataEvento}T${horaInicio}`;
            const endDateTime = (atividade.fimAgendado || atividade.horaFim) 
              ? `${dataEvento}T${atividade.fimAgendado || atividade.horaFim}`
              : null;

            return {
              id: atividade.id,
              title: `${atividade.descricao || atividade.atividade} - ${atividade.nomePessoalAtribuido || atividade.instrutor}`,
              start: startDateTime,
              end: endDateTime,
              color: atividade.confirmada ? '#28a745' : '#dc3545',
              extendedProps: {
                descricao: atividade.descricao || atividade.atividade,
                instrutor: atividade.nomePessoalAtribuido || atividade.instrutor,
                local: atividade.descricaoLocalizacaoAtribuida || atividade.local || '',
                status: atividade.confirmada || false
              }
            };
          } catch (error) {
            console.error('Erro ao processar atividade:', atividade, error);
            return null;
          }
        }).filter(evento => evento !== null);

        console.log('Eventos gerados:', eventos);
        successCallback(eventos);
      } catch (error) {
        console.error('Erro ao carregar eventos:', error);
        failureCallback(error.message);
      }
    },

    // Manipulação de eventos
    eventClick: function(info) {
      const evento = info.event;
      
      // Aqui você pode implementar a abertura de um modal de detalhes
      alert(`Aula: ${evento.title}\nStatus: ${evento.extendedProps.status ? 'Confirmada' : 'Pendente'}`);
    },

    // Atualização quando evento é arrastado
    eventDrop: async function(info) {
      try {
        const response = await fetch(`http://localhost:5500/api/atividades/${info.event.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            datasAtividadeIndividual: formatDate(info.event.start),
            horaInicioAgendada: formatTime(info.event.start),
            fimAgendado: info.event.end ? formatTime(info.event.end) : null
          })
        });

        if (!response.ok) {
          throw new Error('Erro ao atualizar atividade');
        }
      } catch (error) {
        console.error('Erro:', error);
        info.revert(); // Reverte a mudança em caso de erro
      }
    }
  });

  // Renderiza o calendário
  calendar.render();

  // Botão para recarregar eventos
  document.getElementById('reload-events')?.addEventListener('click', function() {
    calendar.refetchEvents();
  });

  // Adiciona estilos dinâmicos
  const style = document.createElement('style');
  style.textContent = `
    .fc-event-content {
      padding: 2px 4px;
      overflow: hidden;
    }
    .fc-event-title {
      font-weight: bold;
      margin-bottom: 2px;
    }
    .fc-event-time {
      font-size: 0.85em;
    }
  `;
  document.head.appendChild(style);
});