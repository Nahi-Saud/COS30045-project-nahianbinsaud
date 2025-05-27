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
  container.html('');

  const data = datasets[currentTab];
  if (!data) return;

  const years = [...new Set(data.map(d => d.YEAR))].filter(Boolean);
  const jurisdictions = [...new Set(data.map(d => d.JURISDICTION))].filter(Boolean);

  addDropdown(container, 'Year', years, 'yearFilter');
  addDropdown(container, 'Jurisdiction', jurisdictions, 'jurisdictionFilter');

  if (['fines',  'drug'].includes(currentTab)) {
    const ageGroups = [...new Set(data.map(d => d.AGE_GROUP))].filter(Boolean);
    addDropdown(container, 'Age Group', ageGroups, 'ageGroupFilter');
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

  const yearEl = d3.select('#yearFilter').node();
  const jurEl = d3.select('#jurisdictionFilter').node();
  const ageEl = d3.select('#ageGroupFilter').node();
  const detEl = d3.select('#detectionFilter').node();

  if (!yearEl || !jurEl) return [];

  const year = yearEl.value;
  const jur = jurEl.value;
  const age = ageEl ? ageEl.value : null;
  const det = detEl ? detEl.value : null;

  return data.filter(d =>
    (year === 'All' || d.YEAR == year) &&
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
  const data = getFilteredData();
  const container = d3.select('#tab-alcohol');
  container.selectAll('*').remove();

  if (!data.length) {
    container.append('p').text('No data available for selected filters.');
    return;
  }

  // Group by YEAR and METRIC
  const grouped = d3.rollups(
    data,
    v => d3.sum(v, d => +d.COUNT || 0),
    d => d.YEAR,
    d => d.METRIC
  );

  // Transform to flat array: [{YEAR, METRIC, COUNT}]
  const flat = [];
  grouped.forEach(([year, metrics]) => {
    metrics.forEach(([metric, count]) => {
      flat.push({ year, metric, count });
    });
  });

  const margin = { top: 40, right: 80, bottom: 50, left: 60 };
  const width = 800;
  const height = 400;

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);

  const years = [...new Set(flat.map(d => d.year))].sort();
  const metrics = [...new Set(flat.map(d => d.metric))];

  const x = d3.scalePoint().domain(years).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(flat, d => d.count)]).nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(metrics)
    .range(['#007acc', '#ff7f0e']);

  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.count));

  metrics.forEach(metric => {
    const series = flat.filter(d => d.metric === metric);

    svg.append('path')
      .datum(series)
      .attr('fill', 'none')
      .attr('stroke', color(metric))
      .attr('stroke-width', 2)
      .attr('d', line);

    svg.selectAll(`.dot-${metric}`)
      .data(series)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.count))
      .attr('r', 3)
      .attr('fill', color(metric));
  });

  // Title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .text('Total Alcohol & Drug Tests Conducted per Year');

  // Legend
  const legend = svg.selectAll('.legend')
    .data(metrics)
    .enter()
    .append('g')
    .attr('transform', (d, i) => `translate(${width - margin.right + 10},${margin.top + i * 20})`);

  legend.append('rect')
    .attr('x', 0)
    .attr('width', 10)
    .attr('height', 10)
    .attr('fill', d => color(d));

  legend.append('text')
    .attr('x', 15)
    .attr('y', 9)
    .text(d => d.replace('_', ' '))
    .style('font-size', '12px');
}


function renderBreath() {
  const container = d3.select('#tab-breath');
  container.selectAll('*').remove();

  const totalData = datasets.alcohol.filter(d => d.METRIC === 'breath_tests_conducted');
  const positiveData = datasets.breath;

  if (!totalData.length || !positiveData.length) {
    container.append('p').text('Breath test data unavailable.');
    return;
  }

  const yearVal = d3.select('#yearFilter').node()?.value || 'All';
  const jurVal = d3.select('#jurisdictionFilter').node()?.value || 'All';

  const totalFiltered = totalData.filter(d =>
    (yearVal === 'All' || d.YEAR == yearVal) &&
    (jurVal === 'All' || d.JURISDICTION === jurVal)
  );

  const positiveFiltered = positiveData.filter(d =>
    (yearVal === 'All' || d.YEAR == yearVal) &&
    (jurVal === 'All' || d.JURISDICTION === jurVal)
  );

  const totalByYear = d3.rollup(
    totalFiltered,
    v => d3.sum(v, d => +d.COUNT || 0),
    d => d.YEAR
  );

  const positiveByYear = d3.rollup(
    positiveFiltered,
    v => d3.sum(v, d => +d.COUNT || 0),
    d => d.YEAR
  );

  const years = Array.from(totalByYear.keys()).sort();
  const totals = years.map(y => totalByYear.get(y));
  const positives = years.map(y => positiveByYear.get(y) || 0);
  const percentages = totals.map((t, i) => t > 0 ? positives[i] / t * 100 : 0);

  const margin = { top: 50, right: 60, bottom: 50, left: 70 };
  const width = 800;
  const height = 400;

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);

  const x = d3.scaleBand()
    .domain(years)
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const yLeft = d3.scaleLinear()
    .domain([0, d3.max(totals)]).nice()
    .range([height - margin.bottom, margin.top]);

  const yRight = d3.scaleLinear()
    .domain([0, d3.max(percentages)]).nice()
    .range([height - margin.bottom, margin.top]);

  // X Axis
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format('d')));

  // Y Axes
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(yLeft).ticks(6));

  svg.append('g')
    .attr('transform', `translate(${width - margin.right},0)`)
    .call(d3.axisRight(yRight).ticks(6).tickFormat(d => `${d.toFixed(1)}%`));

  // Bars - Breath Tests
  svg.selectAll('.bar')
    .data(years)
    .enter()
    .append('rect')
    .attr('x', d => x(d))
    .attr('y', d => yLeft(totalByYear.get(d)))
    .attr('width', x.bandwidth())
    .attr('height', d => height - margin.bottom - yLeft(totalByYear.get(d)))
    .attr('fill', '#1f77b4');

  // Line - % Positive
  const line = d3.line()
    .x((d, i) => x(years[i]) + x.bandwidth() / 2)
    .y(d => yRight(d));

  svg.append('path')
    .datum(percentages)
    .attr('fill', 'none')
    .attr('stroke', 'orange')
    .attr('stroke-width', 2)
    .attr('d', line);

  svg.selectAll('.dot')
    .data(percentages)
    .enter()
    .append('circle')
    .attr('cx', (d, i) => x(years[i]) + x.bandwidth() / 2)
    .attr('cy', d => yRight(d))
    .attr('r', 3)
    .attr('fill', 'orange');

  // Title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 25)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .text('Breath Tests vs % Positive Results');

  // Legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 160},${margin.top})`);

  legend.append('rect')
    .attr('width', 15)
    .attr('height', 15)
    .attr('fill', '#1f77b4');

  legend.append('text')
    .attr('x', 20)
    .attr('y', 12)
    .style('font-size', '12px')
    .text('Breath Tests');

  legend.append('line')
    .attr('x1', 0)
    .attr('y1', 25)
    .attr('x2', 15)
    .attr('y2', 25)
    .attr('stroke', 'orange')
    .attr('stroke-width', 2);

  legend.append('text')
    .attr('x', 20)
    .attr('y', 29)
    .style('font-size', '12px')
    .text('% Positive');
}






function renderDrug() {
  const container = d3.select('#tab-drug');
  container.selectAll('*').remove();

  const data = getFilteredData();
  if (!data.length) {
    container.append('p').text('Drug test data is unavailable or zero for selected filters.');
    return;
  }

  // Group total tests and arrests by year
  const totalByYear = d3.rollup(
    data,
    v => d3.sum(v, d => +d.COUNT || 0),
    d => d.YEAR
  );

  const arrestsByYear = d3.rollup(
    data,
    v => d3.sum(v, d => +d.ARRESTS || 0),
    d => d.YEAR
  );

  const years = Array.from(totalByYear.keys()).sort();
  const totals = years.map(y => totalByYear.get(y));
  const arrests = years.map(y => arrestsByYear.get(y) || 0);
  const arrestRates = totals.map((t, i) => t > 0 ? (arrests[i] / t) * 100 : 0);

  // Setup chart
  const margin = { top: 40, right: 60, bottom: 50, left: 70 };
  const width = 800, height = 400;

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);

  const x = d3.scaleBand()
    .domain(years)
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const yLeft = d3.scaleLinear()
    .domain([0, d3.max(totals)]).nice()
    .range([height - margin.bottom, margin.top]);

  const yRight = d3.scaleLinear()
    .domain([0, d3.max(arrestRates)]).nice()
    .range([height - margin.bottom, margin.top]);

  // X Axis
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format('d')));

  // Y Left Axis - Total Tests
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(yLeft));

  // Y Right Axis - % Arrests
  svg.append('g')
    .attr('transform', `translate(${width - margin.right},0)`)
    .call(d3.axisRight(yRight).ticks(6).tickFormat(d => `${d.toFixed(1)}%`));

  // Bars - Positive Drug Tests
  svg.selectAll('.bar')
    .data(years)
    .enter()
    .append('rect')
    .attr('x', d => x(d))
    .attr('y', d => yLeft(totalByYear.get(d)))
    .attr('width', x.bandwidth())
    .attr('height', d => height - margin.bottom - yLeft(totalByYear.get(d)))
    .attr('fill', '#2ca02c');

  // Line - % Arrests
  const line = d3.line()
    .x((d, i) => x(years[i]) + x.bandwidth() / 2)
    .y(d => yRight(d));

  svg.append('path')
    .datum(arrestRates)
    .attr('fill', 'none')
    .attr('stroke', '#ff7f0e')
    .attr('stroke-width', 2)
    .attr('d', line);

  // Title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .text('Positive Drug Tests vs % Resulting in Arrest');

  // Legend
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 200},${margin.top})`);

  legend.append('rect')
    .attr('x', 0).attr('y', 0).attr('width', 15).attr('height', 15)
    .attr('fill', '#2ca02c');
  legend.append('text')
    .attr('x', 20).attr('y', 12)
    .text('Positive Drug Tests');

  legend.append('line')
    .attr('x1', 0).attr('y1', 25)
    .attr('x2', 15).attr('y2', 25)
    .attr('stroke', '#ff7f0e')
    .attr('stroke-width', 2);
  legend.append('text')
    .attr('x', 20).attr('y', 30)
    .text('% Arrests');
}

