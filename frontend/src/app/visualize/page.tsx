'use client';

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import ClientOnly from "@/components/ClientOnly"; // adjust path if needed

const COLORS = ['#8884d8', '#82ca9d', '#ffc658'];

export default function VisualizePage() {
  const [macros, setMacros] = useState({ protein: 30, carbs: 40, fat: 10 });

  const data = [
    { name: 'Protein', value: macros.protein * 4 },
    { name: 'Carbs', value: macros.carbs * 4},
    { name: 'Fat', value: macros.fat * 4},
  ];

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Visualize Macros</h1>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {['protein', 'carbs', 'fat'].map((type) => (
          <div key={type}>
            <label className="block mb-1 font-semibold capitalize">{type}</label>
            <input
              type="number"
              value={(macros as any)[type]}
              onChange={(e) =>
                setMacros({ ...macros, [type]: parseInt(e.target.value) || 0 })
              }
              className="w-full border p-2 rounded"
            />
          </div>
        ))}
      </div>

      <ClientOnly>
        <PieChart width={400} height={300}>
          <Pie
            data={data}
            cx={200}
            cy={150}
            labelLine={false}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            label={({ name, value }) => `${name}: ${value} cal`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ClientOnly>
    </div>
  );
}
