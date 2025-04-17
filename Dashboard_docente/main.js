// --- ITEM SELECTED | SIDE MENU --- //
// Seleciona todos os elementos com a classe '.component' (itens do menu)
const menuItems = document.querySelectorAll('.component')

// Adiciona um evento de clique a cada item do menu
menuItems.forEach(item =>
  item.addEventListener('click', function () {
    // Remove a classe 'selected' de todos os itens do menu
    menuItems.forEach(item => item.classList.remove('selected'))
    // Adiciona a classe 'selected' apenas ao item clicado (this)
    this.classList.add('selected')
  })
)

// --- HIDDEN | SIDE MENU --- //
// Seleciona o menu lateral (elemento com a classe '.nav')
const sideMenu = document.querySelector('.nav')
// Seleciona o botão que abre/fecha o menu (elemento com a classe '.chevron-icon')
const button = document.querySelector('.chevron-icon')
// Seleciona o contêiner principal (elemento com a classe '.container')
const container = document.querySelector('.container')

// Adiciona um evento de clique ao botão
button.addEventListener('click', () => {
  // Alterna a classe 'hidden' no menu lateral (oculta/mostra o menu)
  sideMenu.classList.toggle('hidden')
  // Alterna a classe 'changed' no contêiner (ajusta o layout quando o menu é aberto/fechado)
  container.classList.toggle('changed')
})

// --- BAR CHART | DEMOGRAPHIC --- //
// Define os valores percentuais para cada barra de progresso
const demographic = {
  first: 30,  // 30%
  second: 42, // 42%
  third: 18,  // 18%
  fourth: 10  // 10%
}

// Seleciona todas as barras de progresso (elementos dentro de '.progress-bar-group')
const progressBars = document.querySelectorAll('.progress-bar-group div')

// Itera sobre cada barra de progresso
for (let progressBar of progressBars) {
  // Obtém o nome da classe da barra de progresso (ex: 'first', 'second', etc.)
  const progressBarName = progressBar.className

  // Define a largura da barra de progresso com base no valor correspondente no objeto 'demographic'
  progressBar.setAttribute(
    'style',
    `width: ${demographic[`${progressBarName}`]}%`
  )
}

// --- PROGRESS BAR | TOP CHANNEL --- //
// Define os valores percentuais para cada canal (ex: PHP, JavaScript, etc.)
const topChannels = {
  PHP: 70,        // 70%
  JAVASCRIPT: 50, // 50%
  JAVA: 90,       // 90%
  PYTHON: 30      // 30%
}

// Seleciona todos os elementos com a classe '.channel-name' (nomes dos canais)
const channels = document.querySelectorAll('.channel-name')

// Itera sobre cada canal
for (let channel of channels) {
  // Obtém o nome do canal (ex: 'PHP', 'JAVASCRIPT', etc.)
  const channelName = channel.textContent
  // Seleciona a barra de progresso correspondente ao canal
  const bar = channel.parentElement.childNodes[9].childNodes[1]

  // Define a largura da barra de progresso com base no valor correspondente no objeto 'topChannels'
  bar.setAttribute('style', `width: ${topChannels[`${channelName}`]}%`)
}

// --- CHARTS.JS --- //
// Doughnut Chart (Gráfico de Rosca) //
// Seleciona o elemento canvas onde o gráfico de rosca será renderizado
const doughnutChart = document.getElementById('myChart')

// Define os dados do gráfico de rosca
const dataDoughnut = {
  labels: ['Cimatec3', 'Cimatec4', 'Cimatec2'], // Rótulos das fatias
  datasets: [
    {
      label: 'Demographic', // Legenda do conjunto de dados
      data: [53, 35, 12],   // Valores das fatias
      backgroundColor: [     // Cores das fatias
        'rgba(1, 126, 250, 1)',
        'rgba(81, 203, 255, 1)',
        'rgba(48, 216, 135, 1)'
      ],
      hoverOffset: 4,        // Distância ao passar o mouse
      cutout: '60%'          // Tamanho do buraco no centro (60%)
    }
  ]
}

// Configurações do gráfico de rosca
const configDoughnut = {
  type: 'doughnut', // Tipo de gráfico
  data: dataDoughnut, // Dados do gráfico
  options: {
    responsive: true, // Torna o gráfico responsivo
    plugins: {
      legend: {
        position: 'bottom', // Posição da legenda
        labels: {
          font: {
            family: "'Poppins', 'sans-serif'", // Fonte da legenda
            size: 10, // Tamanho da fonte
            weight: 400 // Peso da fonte
          },
          padding: 15, // Espaçamento interno
          color: 'rgba(0, 0, 0, 1)', // Cor do texto
          usePointStyle: true // Usa ícones na legenda
        }
      },
      tooltip: {
        enable: false, // Desativa tooltips
        position: 'average',
        external: 'abc'
      }
    }
  }
}

// Cria o gráfico de rosca
const myChart = new Chart(doughnutChart, configDoughnut)

// Line Chart (Gráfico de Linha) //
// Seleciona o elemento canvas onde o gráfico de linha será renderizado
const lineChart = document.getElementById('chartMain')

// Define os dados do gráfico de linha
const dataLine = {
  labels: [ // Rótulos do eixo X (meses do ano)
    'Jan', 'Fev', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
  datasets: [
    {
      label: 'Alcance', // Legenda do primeiro conjunto de dados
      data: [65, 92, 53, 114, 72, 98, 185, 176, 99, 135, 150, 147], // Valores
      backgroundColor: 'rgba(1, 126, 250, 1)', // Cor de fundo
      borderColor: 'rgba(1, 126, 250, 1)', // Cor da linha
      borderWidth: 2 // Largura da linha
    },
    {
      label: 'Aulas planejadas', // Legenda do segundo conjunto de dados
      data: [49, 111, 102, 49, 58, 140, 133, 115, 128, 89, 138, 190], // Valores
      backgroundColor: 'rgba(48, 217, 135, 1)', // Cor de fundo
      borderColor: 'rgba(48, 217, 135, 1)', // Cor da linha
      borderWidth: 2 // Largura da linha
    },
    {
      label: 'Aulas faltando', // Legenda do terceiro conjunto de dados
      data: [22, 48, 41, 53, 82, 64, 55, 47, 50, 62, 58, 84], // Valores
      backgroundColor: 'rgba(253, 31, 155, 1)', // Cor de fundo
      borderColor: 'rgba(253, 31, 155, 1)', // Cor da linha
      borderWidth: 2 // Largura da linha
    }
  ]
}

// Configurações gerais do gráfico de linha
const genericOptions = {
  responsive: true, // Torna o gráfico responsivo
  hoverBackgroundColor: 'white', // Cor de fundo ao passar o mouse
  hoverRadius: 7, // Tamanho do ponto ao passar o mouse
  hoverBorderWidth: 3, // Largura da borda ao passar o mouse
  onHover: { mode: ['dataset', 'tooltip'] }, // Comportamento ao passar o mouse
  scales: {
    x: { grid: { display: false } }, // Remove as linhas de grade do eixo X
    y: {
      min: 0, // Valor mínimo do eixo Y
      max: 200, // Valor máximo do eixo Y
      ticks: { stepSize: 50 }, // Intervalo entre os valores do eixo Y
      grid: { borderDash: [5, 5] } // Estilo das linhas de grade (tracejadas)
    }
  },
  layout: {
    padding: {
      bottom: 10, // Espaçamento inferior
      left: 15,   // Espaçamento à esquerda
      right: 25   // Espaçamento à direita
    }
  },
  interaction: {
    mode: 'index', // Modo de interação (mostra tooltips para todos os datasets no mesmo índice)
    intersect: false // Tooltips aparecem mesmo sem passar diretamente sobre um ponto
  },
  plugins: {
    legend: { display: false }, // Oculta a legenda
    tooltip: {
      padding: 16, // Espaçamento interno do tooltip
      titleFont: {
        family: "'Poppins', 'sans-serif'", // Fonte do título
        size: 16, // Tamanho da fonte
        weight: 'normal' // Peso da fonte
      },
      backgroundColor: 'rgba(8, 26, 81, 1)', // Cor de fundo do tooltip
      bodyColor: 'rgba(255, 255, 255, 0.7)', // Cor do texto do tooltip
      bodyFont: {
        family: "'Poppins', 'sans-serif'", // Fonte do corpo
        size: 15 // Tamanho da fonte
      },
      bodySpacing: 8, // Espaçamento entre as linhas do tooltip
      boxHeight: 6, // Altura da caixa de cor na legenda
      boxPadding: 8, // Espaçamento interno da caixa de cor
      usePointStyle: true, // Usa ícones na legenda
      callbacks: {
        title: ctx => {
          return `${ctx[0].label} 2025` // Título do tooltip (ex: "Jan 2025")
        },
        label: ctx => {
          return `${ctx.dataset.label}:  ${ctx.raw}K` // Rótulo do tooltip (ex: "Alcance: 65K")
        }
      }
    }
  }
}

// Plugin para adicionar uma linha vertical ao passar o mouse
const annotationLine = {
  id: 'annotationLine',
  beforeDraw: chart => {
    if (chart.tooltip._active && chart.tooltip._active.length) {
      const ctx = chart.ctx
      ctx.save()
      const activePoint = chart.tooltip._active[0]
      const display = lineChart.getContext('2d')

      // Cria um gradiente para a linha vertical
      const gradient = display.createLinearGradient(0, 0, 0, 330)
      gradient.addColorStop(0, 'rgba(37, 75, 209, 0)')
      gradient.addColorStop(1, 'rgba(37, 75, 209, 0.1)')

      ctx.beginPath()
      ctx.moveTo(activePoint.element.x, chart.chartArea.top)
      ctx.lineTo(activePoint.element.x, chart.chartArea.bottom)
      ctx.lineWidth = 40
      ctx.strokeStyle = gradient
      ctx.strokeRect(activePoint.element.x, chart.chartArea.top, 0, 282)
      ctx.restore()
    }
  }
}

// Plugin para adicionar uma linha tracejada ao passar o mouse
const lineDash = {
  id: 'lineDash',
  beforeDraw: chart => {
    if (chart.tooltip._active && chart.tooltip._active.length) {
      const ctx = chart.ctx
      ctx.save()
      const activePoint = chart.tooltip._active[0]

      ctx.beginPath()
      ctx.setLineDash([5, 5]) // Define o padrão de tracejado
      ctx.moveTo(activePoint.element.x, chart.chartArea.top)
      ctx.lineTo(activePoint.element.x, chart.chartArea.bottom)
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(1, 126, 250, 0.8)' // Cor da linha
      ctx.stroke()
      ctx.restore()
    }
  }
}

// Configurações do gráfico de linha
const configLine = {
  type: 'line', // Tipo de gráfico
  data: dataLine, // Dados do gráfico
  options: genericOptions, // Opções gerais
  plugins: [annotationLine, lineDash] // Plugins adicionais
}

// Cria o gráfico de linha
const chartMain = new Chart(lineChart, configLine)