// prisma/seed.ts
export interface NewsItem {
  id?: number;
  title: string;
  snippet: string;
  url: string;
  date: Date;
  tags: string[];
  countries: string[];
}
export const newsData = [
    {
      title: 'Solar Microgrids Power Remote Indian Villages',
      snippet: 'Nonprofit organisations install off-grid solar units in Maharashtra, providing electricity to over 500 homes.',
      url: 'https://example.com/solar-india',
      date: new Date('2025-07-05'),
      tags: ['solar','microgrid','rural'],
      countries: ['India']
    },
    {
      title: 'Floating Offshore Wind Farms Debut in South Korea',
      snippet: 'South Korea commissions its first floating turbines, harnessing deep-water wind resources.',
      url: 'https://example.com/wind-korea',
      date: new Date('2025-06-28'),
      tags: ['wind','offshore','innovation'],
      countries: ['South Korea']
    },
    {
      title: 'Hydroelectric Expansion Underway in Nepal',
      snippet: 'New dam projects alongside the Karnali River boost capacity by 200MW.',
      url: 'https://example.com/hydro-nepal',
      date: new Date('2025-06-18'),
      tags: ['hydro','water','capacity'],
      countries: ['Nepal']
    },
    {
      title: 'Geothermal District Heating in Reykjavik Hits Milestone',
      snippet: 'Reykjavik reaches 100% district heating coverage using geothermal wells beneath the city.',
      url: 'https://example.com/geothermal-iceland',
      date: new Date('2025-05-30'),
      tags: ['geothermal','district heating'],
      countries: ['Iceland']
    },
    {
      title: 'Electric Vehicle Registrations Surge in Norway',
      snippet: 'EVs constitute 80% of new car sales in Norway for Q2 2025.',
      url: 'https://example.com/ev-norway',
      date: new Date('2025-06-10'),
      tags: ['ev','transport','policy'],
      countries: ['Norway']
    },
    {
      title: 'Solid-state Battery Trials Begin in Japan',
      snippet: 'A consortium of automakers tests next-gen batteries with double the energy density.',
      url: 'https://example.com/battery-japan',
      date: new Date('2025-05-15'),
      tags: ['battery','solid-state','tech'],
      countries: ['Japan']
    },
    {
      title: 'Biogas Plants Ramp Up in Germany',
      snippet: 'Farm-based biogas systems supply renewable gas to over 100,000 households.',
      url: 'https://example.com/biogas-germany',
      date: new Date('2025-04-25'),
      tags: ['bioenergy','biogas','agriculture'],
      countries: ['Germany']
    },
    {
      title: 'Canada Mandates Net-Zero Homes by 2030',
      snippet: 'Federal policy requires all new residential buildings to meet net-zero ready standards.',
      url: 'https://example.com/netzero-canada',
      date: new Date('2025-04-15'),
      tags: ['efficiency','policy','buildings'],
      countries: ['Canada']
    },
    {
      title: 'Green Hydrogen Pilot Plants in Australia',
      snippet: 'Two new electrolyser facilities produce green hydrogen for export to Asia.',
      url: 'https://example.com/hydrogen-australia',
      date: new Date('2025-05-20'),
      tags: ['hydrogen','pilot','export'],
      countries: ['Australia']
    },
    {
      title: 'Tidal Energy Prototypes Tested in UK Firths',
      snippet: 'Tidal turbine arrays undergo stress tests in fast-moving currents off Scotland’s coast.',
      url: 'https://example.com/tidal-uk',
      date: new Date('2025-03-30'),
      tags: ['tidal','marine'],
      countries: ['United Kingdom']
    },
    {
      title: 'Carbon Capture Facilities Online in Texas',
      snippet: 'Two new CCS plants capture over 1 million tonnes of CO₂ annually.',
      url: 'https://example.com/ccs-texas',
      date: new Date('2025-06-05'),
      tags: ['ccs','carbon capture','us'],
      countries: ['United States']
    },
    {
      title: 'Smart Grid Projects Accelerate in China',
      snippet: 'Advanced grid controls reduce peak demand by 15% in pilot cities.',
      url: 'https://example.com/smartgrid-china',
      date: new Date('2025-05-10'),
      tags: ['grid','smart grid','demand response'],
      countries: ['China']
    }
  ];

export default { newsData };