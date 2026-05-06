import type { Component } from 'solid-js';
import { parseCSV, assignBranches, defaultWeights } from '../../lib/dataParser';
import { loadData } from '../../store/fitStore';
import type { DataPoint } from '../../store/fitStore';

export const DataInput: Component = () => {
  const onFileUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const raw = parseCSV(text);
      const branched = assignBranches(raw);
      const weights = defaultWeights(branched);
      
      const data: DataPoint[] = branched.map((p, i) => ({
        xA: p.xA,
        T: p.T,
        branch: p.branch as any,
        weight: weights[i],
        sigma: p.sigma ?? 1,
      }));
      
      loadData(data);
    };
    reader.readAsText(file);
  };

  return (
    <div class="data-input">
      <h3>Загрузка данных</h3>
      <input type="file" accept=".csv" onChange={onFileUpload} />
      <p class="hint">CSV: xA, T (разделитель запятая, заголовок обязателен)</p>
    </div>
  );
};