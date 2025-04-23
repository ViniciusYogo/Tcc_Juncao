document.addEventListener('DOMContentLoaded', function () {
  // Verifica se estamos na página correta antes de executar
  if (!document.querySelector('.calendario')) {
    console.log('Elemento .calendario não encontrado - saindo do script');
    return;
  }

  // Elementos do calendário
  const mesAnoElemento = document.getElementById('mes-ano');
  const semanaAnteriorBtn = document.getElementById('semana-anterior');
  const hojeBtn = document.getElementById('hoje');
  const proximaSemanaBtn = document.getElementById('proxima-semana');

  // Verifica se todos os elementos necessários existem
  if (!mesAnoElemento || !semanaAnteriorBtn || !hojeBtn || !proximaSemanaBtn) {
    console.error('Elementos essenciais do calendário não encontrados');
    return;
  }

  // Variáveis de estado
  let dataAtual = new Date();
  let dataInicioSemana = getInicioSemana(dataAtual);

  // Nomes dos meses para exibição
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  /**
   * Obtém a data de início da semana (segunda-feira)
   * @param {Date} date - Data de referência
   * @returns {Date} Data do início da semana
   */
  function getInicioSemana(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuste para segunda-feira
    return new Date(d.setDate(diff));
  }

  /**
   * Renderiza a semana começando na data especificada
   * @param {Date} dataInicio - Data de início da semana
   */
  async function renderizarSemana(dataInicio) {
    try {
      // Atualiza o cabeçalho com mês/ano
      const mes = dataInicio.getMonth();
      const ano = dataInicio.getFullYear();
      mesAnoElemento.textContent = `${meses[mes]} ${ano}`;

      // Para cada dia da semana (segunda a sábado)
      for (let i = 0; i < 6; i++) {
        const dataDia = new Date(dataInicio);
        dataDia.setDate(dataInicio.getDate() + i);

        const diaElemento = document.querySelector(`.dias .dia:nth-child(${i + 1})`);
        if (!diaElemento) continue;

        // Atualiza a data no cabeçalho do dia
        diaElemento.querySelector('.numero-data').textContent = dataDia.getDate();
        diaElemento.querySelector('.mes-data').textContent = meses[dataDia.getMonth()].substring(0, 3);

        // Limpa eventos anteriores
        const eventosElemento = diaElemento.querySelector('.eventos');
        eventosElemento.innerHTML = '';

        // Busca os horários para o dia
        const horarios = await buscarHorarios(dataDia.getDate(), dataDia.getMonth() + 1, dataDia.getFullYear());

        // Adiciona os eventos ao dia
        adicionarEventosAoDia(eventosElemento, horarios);
      }

    } catch (error) {
      console.error('Erro ao renderizar semana:', error);
    }
  }

  /**
   * Adiciona eventos a um dia do calendário
   * @param {HTMLElement} container - Elemento onde os eventos serão inseridos
   * @param {Array} eventos - Array de eventos
   */
  function adicionarEventosAoDia(container, eventos) {
    if (!eventos || eventos.length === 0) {
      const semEventos = document.createElement('div');
      semEventos.className = 'sem-eventos';
      semEventos.textContent = 'Sem atividades';
      container.appendChild(semEventos);
      return;
    }

    eventos.forEach(evento => {
      const eventoElement = document.createElement('div');
      eventoElement.className = 'evento';
      eventoElement.innerHTML = `
        <div class="evento-hora">${evento.hora}</div>
        <div class="evento-titulo">${evento.atividade}</div>
        <div class="evento-vagas">${evento.vagas} vagas</div>
      `;

      // Adiciona clique para edição
      eventoElement.addEventListener('click', () => abrirModalEdicao(evento));

      container.appendChild(eventoElement);
    });
  }

  /**
   * Abre o modal de edição com os dados do evento
   * @param {Object} evento - Dados do evento
   */
  function abrirModalEdicao(evento) {
    const modal = document.getElementById('modalEdicao');
    if (!modal) return;

    // Preenche o formulário com os dados do evento
    document.getElementById('editDescricao').value = evento.atividade;
    document.getElementById('editProfessor').value = evento.instrutor || '';
    document.getElementById('editHoraInicio').value = evento.hora + ':00';
    // Adicione outros campos conforme necessário

    modal.style.display = 'block';
  }

  async function buscarHorarios(dia, mes, ano) {
    try {
      // Faz a chamada para a API real
      const response = await fetch(`/api/atividades?dia=${dia}&mes=${mes}&ano=${ano}`);
      // Verifica se a resposta foi bem sucedida
      if (!response.ok) {
        throw new Error(`Erro HTTP! status: ${response.status}`);
      }

      // Verifica se o conteúdo é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new TypeError('A resposta não é JSON');
      }

      // Extrai os dados da resposta
      const data = await response.json();

      // Retorna os horários ou array vazio se não houver dados
      return data.success ? data.data : [];

    } catch (error) {
      console.error('Erro na requisição de atividades:', error);
      // Retorna array vazio em caso de erro para não quebrar a interface
      return [];
    }
  }

  /**
   * Configura os eventos para fechar o modal
   */
  function configurarFechamentoModal() {
    const modal = document.getElementById('modalEdicao');
    const closeBtn = document.querySelector('.botao-cancelar');

    if (!modal || !closeBtn) return;

    // Fechar ao clicar no botão Cancelar
    closeBtn.addEventListener('click', function () {
      modal.style.display = 'none';
    });

    // Fechar ao clicar fora do modal
    window.addEventListener('click', function (event) {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });

    // Fechar com a tecla ESC
    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.style.display === 'block') {
        modal.style.display = 'none';
      }
    });
  }

  // Event listeners para navegação entre semanas
  semanaAnteriorBtn.addEventListener('click', function () {
    dataInicioSemana.setDate(dataInicioSemana.getDate() - 7);
    renderizarSemana(dataInicioSemana);
  });

  hojeBtn.addEventListener('click', function () {
    dataInicioSemana = getInicioSemana(new Date());
    renderizarSemana(dataInicioSemana);
  });

  proximaSemanaBtn.addEventListener('click', function () {
    dataInicioSemana.setDate(dataInicioSemana.getDate() + 7);
    renderizarSemana(dataInicioSemana);
  });

  // Configura o fechamento do modal
  configurarFechamentoModal();

  // Renderiza a semana inicial
  renderizarSemana(dataInicioSemana);
});