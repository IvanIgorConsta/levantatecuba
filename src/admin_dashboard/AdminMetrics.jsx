import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#e63946", "#457b9d", "#f4a261", "#2a9d8f"];

export default function AdminMetrics() {
  const [countryData, setCountryData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);

  useEffect(() => {
    fetch("/api/metrics")
      .then((res) => res.json())
      .then((data) => {
        setCountryData(data.visitsByCountry || []);
        setDailyData(data.dailyVisits || []);
        setDistributionData(data.distribution || []);
      })
      .catch((err) => console.error("Error al cargar métricas:", err));
  }, []);

  return (
    <div className="text-white">
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-2 text-white">📊 Métricas</h2>
        <p className="text-white/60">Visualiza estadísticas y datos de la plataforma</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Gráfico de Barras por país */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
            <span>🌍</span> Visitas por País
          </h3>
          {countryData.length === 0 ? (
            <p className="text-white/40">No hay datos disponibles aún.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={countryData}>
                <XAxis dataKey="country" stroke="#ccc" />
                <YAxis stroke="#ccc" />
                <Tooltip />
                <Bar dataKey="visits" fill="#e63946" barSize={40} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfico de Línea diario */}
        <div className="admin-card">
          <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
            <span>📈</span> Visitas Últimos 15 Días
          </h3>
          {dailyData.length === 0 ? (
            <p className="text-white/40">No hay datos disponibles aún.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyData}>
                <XAxis dataKey="date" stroke="#ccc" />
                <YAxis stroke="#ccc" />
                <Tooltip />
                <Line type="monotone" dataKey="visits" stroke="#2a9d8f" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gráfico Circular distribución de contenido */}
      <div className="admin-card mt-8 max-w-xl mx-auto">
        <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
          <span>📦</span> Distribución del Contenido
        </h3>
        {distributionData.length === 0 ? (
          <p className="text-white/40 text-center">Sin contenido aún.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ cx, cy, midAngle, innerRadius, outerRadius, name }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = 25 + innerRadius + (outerRadius - innerRadius);
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="#fff"
                      textAnchor={x > cx ? "start" : "end"}
                      dominantBaseline="central"
                      style={{ fontSize: 12, filter: "drop-shadow(1px 1px 2px black)" }}
                    >
                      {name}
                    </text>
                  );
                }}
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
