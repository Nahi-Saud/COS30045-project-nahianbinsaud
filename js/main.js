const datasets = {};
let currentTab = 'fines';

const filePaths = {
  fines: 'data/police_enforcement_2023_fines_2024-09-20.csv',
  alcohol: 'data/police_enforcement_2023_alcohol_drug_tests_2025-02-13.csv',
  breath: 'data/police_enforcement_2023_positive_breath_tests_2024-09-20.csv',
  drug: 'data/police_enforcement_2023_positive_drug_tests_2024-09-20.csv',
};

Promise.all(Object.entries(filePaths).map(([key, path]) =>
  d3.csv(path, d3.autoType).then(data => { datasets[key] = data; })
)).then(() => {
  initTabs();
  initFilters(() => renderCurrentTab());
});

function initTabs() {
  d3.selectAll('.tabs li').on('click', function () {
    currentTab = d3.select(this).attr('data-tab');
    d3.selectAll('.tabs li').classed('active', false);
    d3.select(this).classed('active', true);
    d3.selectAll('.tab-content').classed('visible', false);
    d3.select(`#tab-${currentTab}`).classed('visible', true);
    initFilters(() => renderCurrentTab());
  });
}


function initFilters(callback) {
  const container = d3.select('#filters');
  container.html(''); // Clear old filters

  const data = datasets[currentTab];
  if (!data) return;

  const jurisdictions = [...new Set(data.map(d => d.JURISDICTION))].filter(Boolean);
  addDropdown(container, 'Jurisdiction', jurisdictions, 'jurisdictionFilter');

  if (['fines', 'drug'].includes(currentTab)) {
    const ageGroups = [...new Set(data.map(d => d.AGE_GROUP))].filter(Boolean);
    if (ageGroups.length > 1) {
      addDropdown(container, 'Age Group', ageGroups, 'ageGroupFilter');
    }
  }

  if (currentTab === 'drug') {
    const detectionMethods = [...new Set(data.map(d => d.DETECTION_METHOD))].filter(Boolean);
    addDropdown(container, 'Detection Method', detectionMethods, 'detectionFilter');
  }

  if (typeof callback === 'function') setTimeout(callback, 0);
}



function addDropdown(container, label, options, id) {
  container.append('label').attr('for', id).text(`Select ${label}:`);
  const select = container.append('select').attr('id', id);
  select.append('option').attr('value', 'All').text('All');
  options.sort().forEach(opt => select.append('option').attr('value', opt).text(opt));
  select.on('change', () => renderCurrentTab());
}


function getFilteredData() {
  const data = datasets[currentTab];
  if (!data) return [];

  const jurEl = d3.select('#jurisdictionFilter').node();
  const ageEl = d3.select('#ageGroupFilter').node();
  const detEl = d3.select('#detectionFilter').node();

  const jur = jurEl ? jurEl.value : 'All';
  const age = ageEl ? ageEl.value : null;
  const det = detEl ? detEl.value : null;

  return data.filter(d =>
    d.YEAR == 2023 && 
    (jur === 'All' || d.JURISDICTION === jur) &&
    (!age || age === 'All' || d.AGE_GROUP === age) &&
    (!det || det === 'All' || d.DETECTION_METHOD === det)
  );
}



function renderCurrentTab() {
  switch (currentTab) {
    case 'fines': renderFines(); break;
    case 'alcohol': renderAlcohol(); break;
    case 'breath': renderBreath(); break;
    case 'drug': renderDrug(); break;
  }
}

function renderFines() {
  const data = getFilteredData();
  const container = d3.select('#tab-fines');
  container.selectAll('*').remove();

  if (!data.length) {
    container.append('p').text('No data found for selected filters.');
    return;
  }

  // Filter out 'All ages' and 'Unknown' entries
  const filtered = data.filter(d =>
    d.AGE_GROUP !== 'All ages' && d.AGE_GROUP !== 'Unknown' 
  );

  const grouped = d3.rollup(
    filtered,
    v => d3.sum(v, d => +d.FINES || 0),
    d => d.AGE_GROUP
  );

  const keys = Array.from(grouped.keys()).sort();
  const values = keys.map(k => grouped.get(k));

  const margin = { top: 40, right: 20, bottom: 50, left: 70 };
  const width = 800;
  const height = 400;

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);

  const x = d3.scaleBand().domain(keys).range([margin.left, width - margin.right]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(values)]).nice().range([height - margin.bottom, margin.top]);

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6));

  svg.selectAll('rect')
    .data(keys)
    .enter()
    .append('rect')
    .attr('x', d => x(d))
    .attr('y', d => y(grouped.get(d)))
    .attr('width', x.bandwidth())
    .attr('height', d => height - margin.bottom - y(grouped.get(d)))
    .attr('fill', '#007acc');

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .text('Total Fines by Age Group');
}

function renderAlcohol() {
  const container = d3.select('#tab-alcohol');
  container.selectAll('*').remove();

  const data = datasets.alcohol.filter(d => d.YEAR === 2023);
  const jur = d3.select('#jurisdictionFilter')?.node()?.value || 'All';

  const filtered = data.filter(d =>
    jur === 'All' || d.JURISDICTION === jur
  );

  if (!filtered.length) {
    container.append('p').text('No data available for selected jurisdiction.');
    return;
  }

  const grouped = d3.rollups(
    filtered,
    v => d3.sum(v, d => +d.COUNT || 0),
    d => d.JURISDICTION,
    d => d.METRIC
  );

  const jurisdictions = Array.from(new Set(filtered.map(d => d.JURISDICTION)));
  const metrics = ['breath_tests_conducted', 'drug_tests_conducted'];
  const colorScale = d3.scaleOrdinal()
    .domain(metrics)
    .range(['#1f77b4', '#ff7f0e']);

  const chartData = [];
  grouped.forEach(([jur, metricVals]) => {
    const entry = { jurisdiction: jur };
    metricVals.forEach(([metric, value]) => {
      entry[metric] = value;
    });
    chartData.push(entry);
  });

  // Dimensions
  const margin = { top: 40, right: 30, bottom: 60, left: 80 };
  const width = 800;
  const height = 400;
  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);

  const x0 = d3.scaleBand()
    .domain(chartData.map(d => d.jurisdiction))
    .range([margin.left, width - margin.right])
    .paddingInner(0.2);

  const x1 = d3.scaleBand()
    .domain(metrics)
    .range([0, x0.bandwidth()])
    .padding(0.05);

  const y = d3.scaleLinear()
    .domain([0, d3.max(chartData, d => Math.max(d.breath_tests_conducted || 0, d.drug_tests_conducted || 0))])
    .nice()
    .range([height - margin.bottom, margin.top]);

  // Axes
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x0));

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6));

  // Bars
  svg.append('g')
    .selectAll('g')
    .data(chartData)
    .join('g')
    .attr('transform', d => `translate(${x0(d.jurisdiction)},0)`)
    .selectAll('rect')
    .data(d => metrics.map(key => ({ key, value: d[key] || 0 })))
    .join('rect')
    .attr('x', d => x1(d.key))
    .attr('y', d => y(d.value))
    .attr('width', x1.bandwidth())
    .attr('height', d => height - margin.bottom - y(d.value))
    .attr('fill', d => colorScale(d.key));

  // Title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .text('Total Alcohol & Drug Tests Conducted (2023)');

  // Legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width - margin.right - 160},${margin.top})`);

  metrics.forEach((metric, i) => {
    const g = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);

    g.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', colorScale(metric));

    g.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .text(metric.replace('_', ' '))
      .attr('font-size', '12px');
  });
}



function renderBreath() {
  const container = d3.select('#tab-breath');
  container.selectAll('*').remove();

  const data = getFilteredData();
  if (!data.length) {
    container.append('p').text('No breath test data found for 2023 with selected filters.');
    return;
  }

  // Group and sum by JURISDICTION or AGE_GROUP if available
  const groupKey = data[0].AGE_GROUP ? 'AGE_GROUP' : 'JURISDICTION';
  const grouped = d3.rollup(
    data,
    v => d3.sum(v, d => +d.COUNT || 0),
    d => d[groupKey]
  );

  const keys = Array.from(grouped.keys()).sort();
  const values = keys.map(k => grouped.get(k));

  const margin = { top: 40, right: 30, bottom: 50, left: 70 };
  const width = 800, height = 400;

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);

  const x = d3.scaleBand()
    .domain(keys)
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(values)]).nice()
    .range([height - margin.bottom, margin.top]);

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.selectAll('rect')
    .data(keys)
    .enter()
    .append('rect')
    .attr('x', d => x(d))
    .attr('y', d => y(grouped.get(d)))
    .attr('width', x.bandwidth())
    .attr('height', d => height - margin.bottom - y(grouped.get(d)))
    .attr('fill', '#c0392b');

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .text(`Positive Breath Tests by ${groupKey}`);
}







function renderDrug() {
  const container = d3.select('#tab-drug');
  container.selectAll('*').remove();

  const data = getFilteredData();
  if (!data.length) {
    container.append('p').text('Drug test data is unavailable or zero for selected filters. Try adjusting the filters.');
    return;
  }

  // Determine grouping key
  const jurFilter = d3.select('#jurisdictionFilter')?.node()?.value || 'All';
  const groupKey = jurFilter === 'All' ? 'JURISDICTION' : 'AGE_GROUP';

  // Group data
  const groupedData = d3.rollup(
    data,
    v => d3.sum(v, d => +d.COUNT || 0),
    d => d[groupKey]
  );

  const keys = Array.from(groupedData.keys()).filter(k => k && k !== 'Unknown').sort();
  const values = keys.map(k => groupedData.get(k));

  // Chart setup
  const margin = { top: 40, right: 40, bottom: 80, left: 70 };
  const width = 800, height = 400;

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);

  const x = d3.scaleBand()
    .domain(keys)
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(values)]).nice()
    .range([height - margin.bottom, margin.top]);

  // X Axis
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  // Y Axis
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Bars
  svg.selectAll('.bar')
    .data(keys)
    .enter()
    .append('rect')
    .attr('x', d => x(d))
    .attr('y', d => y(groupedData.get(d)))
    .attr('width', x.bandwidth())
    .attr('height', d => height - margin.bottom - y(groupedData.get(d)))
    .attr('fill', '#2ca02c');

  // Title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .text(`Positive Drug Tests by ${groupKey}`);
}


