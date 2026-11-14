import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { Users, FileCheck, Calendar as CalendarIcon } from 'lucide-react'
import { Panel } from './Overview'

// Chart panels split into their own chunk: recharts is heavy and must not
// block the metric cards (the LCP element) from painting after the API
// resolves. Loaded via React.lazy with the skeleton grid as fallback.
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-100 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors/95 p-3 shadow-xl backdrop-blur-md">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 transition-colors mb-1">{label || payload[0].name}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="font-medium text-slate-600 dark:text-slate-300 transition-colors">{entry.name}</span>
            </span>
            <span className="font-black text-slate-800 dark:text-slate-100 transition-colors">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function OverviewCharts({ studentData, complianceData, scheduleData }) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Panel title="Student Distribution" subtitle="Breakdown of student statuses" icon={Users}>
        {studentData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={studentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {studentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm font-medium text-slate-400">No student data available</div>
        )}
      </Panel>

      <Panel title="Compliance Health" subtitle="Waivers & documents status" icon={FileCheck}>
        {complianceData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={complianceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {complianceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm font-medium text-slate-400">No compliance data available</div>
        )}
      </Panel>

      <Panel title="Upcoming Schedule" subtitle="Sessions in the next 7 days" icon={CalendarIcon}>
        {(scheduleData[0].Upcoming > 0 || scheduleData[1].Upcoming > 0) ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scheduleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="Upcoming" radius={[6, 6, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm font-medium text-slate-400">No upcoming appointments</div>
        )}
      </Panel>
    </div>
  )
}

export default OverviewCharts
