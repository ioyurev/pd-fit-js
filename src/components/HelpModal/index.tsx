import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { Katex } from '../Katex';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export const HelpModal: Component<HelpModalProps> = (props) => {
  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={props.onClose}>
        <div
          class="modal-content help-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="modal-header">
            <h2>Справка: физико-химические основы расчёта</h2>
            <button class="btn-delete" onClick={props.onClose}>Закрыть</button>
          </div>

          <div class="help-body">

            {/* 1 */}
            <h3>1. Постановка задачи</h3>
            <p>
              Цель — описать линию ликвидуса бинарной системы A–B, то есть зависимость
              температуры начала кристаллизации от состава жидкой фазы. Состав задаётся
              мольной долей компонента B:&nbsp;
              <Katex math="x_B \in [0,\,1]" />, соответственно&nbsp;
              <Katex math="x_A = 1 - x_B" />.
            </p>

            {/* 2 */}
            <h3>2. Уравнение равновесия (Шрёдер – Ле Шателье)</h3>
            <p>
              Условие равновесия твёрдого чистого компонента&nbsp;<Katex math="i" /> с
              жидким раствором:
            </p>
            <Katex display math="\ln\!\left(x_i\,\gamma_i\right) = \frac{\Delta H_{\mathrm{fus},i}}{R}\!\left(\frac{1}{T_{\mathrm{fus},i}} - \frac{1}{T}\right)" />
            <p>где:</p>
            <table class="help-table">
              <tbody>
                <tr><td><Katex math="x_i" /></td><td>мольная доля компонента <Katex math="i" /> в жидкости</td></tr>
                <tr><td><Katex math="\gamma_i" /></td><td>коэффициент активности компонента <Katex math="i" /></td></tr>
                <tr><td><Katex math="\Delta H_{\mathrm{fus},i}" /></td><td>энтальпия плавления, Дж/моль</td></tr>
                <tr><td><Katex math="T_{\mathrm{fus},i}" /></td><td>температура плавления чистого компонента, К</td></tr>
                <tr><td><Katex math="T" /></td><td>температура ликвидуса, К</td></tr>
                <tr><td><Katex math="R = 8.314" /></td><td>универсальная газовая постоянная, Дж/(моль·К)</td></tr>
              </tbody>
            </table>

            {/* 3 */}
            <h3>3. Полиморфные переходы</h3>
            <p>
              Если компонент претерпевает твёрдофазный полиморфный переход при&nbsp;
              <Katex math="T_{\mathrm{tr}} > 0" /> с энтальпией&nbsp;
              <Katex math="\Delta H_{\mathrm{tr}}" />, эффективные параметры плавления
              корректируются по закону Гесса для всех переходов, температура которых
              выше текущей&nbsp;<Katex math="T" />:
            </p>
            <Katex display math="\Delta H_{\mathrm{eff}} = \Delta H_{\mathrm{fus}} + \sum_k \Delta H_{\mathrm{tr},k}" />
            <Katex display math="\Delta S_{\mathrm{eff}} = \frac{\Delta H_{\mathrm{fus}}}{T_{\mathrm{fus}}} + \sum_k \frac{\Delta H_{\mathrm{tr},k}}{T_{\mathrm{tr},k}}" />
            <p>
              Эффективная температура плавления:&nbsp;
              <Katex math="T_{\mathrm{eff}} = \Delta H_{\mathrm{eff}} / \Delta S_{\mathrm{eff}}" />.
              Уравнение Шрёдера принимает вид:
            </p>
            <Katex display math="\ln\!\left(x_i\,\gamma_i\right) = \frac{\Delta H_{\mathrm{eff}}}{R}\!\left(\frac{1}{T_{\mathrm{eff}}} - \frac{1}{T}\right)" />

            {/* 4 */}
            <h3>4. Аналитическое решение для температуры ликвидуса</h3>
            <p>
              Перепишем уравнение Шрёдера, разделив избыточную энергию Гиббса на
              энтальпийную и энтропийную части (см. раздел 5):
            </p>
            <Katex display math="T = \frac{\Delta H_{\mathrm{eff}} + G_i^{ex,H}}{\Delta S_{\mathrm{eff}} - R\ln x_i + G_i^{ex,S}}" />
            <p>
              Это прямое (без итераций) выражение для&nbsp;<Katex math="T" /> при
              заданном&nbsp;<Katex math="x_i" />. При наличии полиморфных переходов
              формула применяется итерационно: если полученная&nbsp;<Katex math="T" />
              оказывается ниже&nbsp;<Katex math="T_{\mathrm{tr}}" />, параметры
              обновляются и&nbsp;<Katex math="T" /> пересчитывается.
            </p>

            {/* 5 */}
            <h3>5. Модель Редлиха – Кистера для избыточной энергии Гиббса</h3>
            <p>
              Избыточная энергия Гиббса жидкого раствора:
            </p>
            <Katex display math="G^{ex} = x_A\,x_B \sum_{v=0}^{n} L_v\,(x_A - x_B)^v" />
            <p>
              Параметры взаимодействия разделены на энтальпийную и энтропийную части:
            </p>
            <Katex display math="L_v(T) = L_v^H - T\,L_v^S" />
            <p>
              Парциальные избыточные энергии Гиббса (логарифмы коэффициентов активности
              умножены на&nbsp;<Katex math="RT" />):
            </p>
            <Katex display math="RT\ln\gamma_A = x_B^2 \sum_{v=0}^{n} L_v\!\left[(x_A-x_B)^v + 2v\,x_A\,(x_A-x_B)^{v-1}\right]" />
            <Katex display math="RT\ln\gamma_B = x_A^2 \sum_{v=0}^{n} L_v\!\left[(x_A-x_B)^v - 2v\,x_B\,(x_A-x_B)^{v-1}\right]" />
            <p>
              В уравнении для&nbsp;<Katex math="T" /> парциальный вклад разбивается:
            </p>
            <Katex display math="G_i^{ex,H} = \left.RT\ln\gamma_i\right|_{L_v \to L_v^H}, \quad G_i^{ex,S} = \left.R\ln\gamma_i\right|_{L_v \to L_v^S}" />

            {/* 6 */}
            <h3>6. Эвтектическая точка</h3>
            <p>
              Эвтектика — точка минимума линии ликвидуса, где обе ветви пересекаются.
              Находится численным сканированием по сетке из 2000 точек:
            </p>
            <Katex display math="T_{\mathrm{eut}} = \min_{x_B} \max\!\left[T_A(x_B),\, T_B(x_B)\right]" />

            {/* 7 */}
            <h3>7. Целевая функция и взвешенные невязки</h3>
            <p>
              Каждой экспериментальной точке&nbsp;
              <Katex math="(x_B^{(k)},\, T^{(k)})" /> приписывается вес&nbsp;
              <Katex math="w_k = 1/\sigma_k^2" />, где&nbsp;<Katex math="\sigma_k" /> —
              стандартная неопределённость измерения температуры. Минимизируется:
            </p>
            <Katex display math="\chi^2 = \sum_k w_k \left[T^{(k)} - T_{\mathrm{calc}}(x_B^{(k)})\right]^2" />

            {/* 8 */}
            <h3>8. Алгоритм Левенберга – Марквардта</h3>
            <p>
              Нелинейная задача наименьших квадратов решается методом
              Левенберга – Марквардта. На каждой итерации вектор поправок&nbsp;
              <Katex math="\delta\mathbf{p}" /> определяется из:
            </p>
            <Katex display math="\left(\mathbf{J}^T \mathbf{W} \mathbf{J} + \lambda\,\mathrm{diag}(\mathbf{J}^T \mathbf{W} \mathbf{J})\right)\delta\mathbf{p} = \mathbf{J}^T \mathbf{W}\,\mathbf{r}" />
            <p>
              где&nbsp;<Katex math="\mathbf{J}" /> — матрица Якоби&nbsp;
              (<Katex math="J_{ki} = \partial T_{\mathrm{calc}}^{(k)} / \partial p_i" />),&nbsp;
              <Katex math="\mathbf{W} = \mathrm{diag}(w_k)" />,&nbsp;
              <Katex math="\mathbf{r}" /> — вектор невязок,&nbsp;
              <Katex math="\lambda" /> — параметр регуляризации.
              При&nbsp;<Katex math="\lambda \to 0" /> метод переходит в
              Гаусса – Ньютона, при&nbsp;<Katex math="\lambda \to \infty" /> —
              в градиентный спуск.
            </p>

            {/* 9 */}
            <h3>9. Ковариационная матрица и погрешности параметров</h3>
            <p>
              После сходимости ковариационная матрица оценивается как:
            </p>
            <Katex display math="\mathbf{C} = \hat{\sigma}^2\,(\mathbf{J}^T \mathbf{W} \mathbf{J})^{-1}" />
            <p>
              где дисперсия единицы веса:
            </p>
            <Katex display math="\hat{\sigma}^2 = \frac{\chi^2}{n - p}" />
            <p>
              (<Katex math="n" /> — число точек, <Katex math="p" /> — число свободных
              параметров). Стандартная погрешность&nbsp;<Katex math="i" />-го параметра:
            </p>
            <Katex display math="\sigma_{p_i} = \sqrt{C_{ii}}" />

            {/* 10 */}
            <h3>10. Статистики качества подгонки</h3>
            <Katex display math="R_{wp} = \sqrt{\frac{\sum_k w_k r_k^2}{\sum_k w_k (T^{(k)})^2}}" />
            <p>
              <Katex math="R_{wp} \times 100\%" /> — взвешенный профильный R-фактор
              (аналог из кристаллографии). Хорошая подгонка:&nbsp;
              <Katex math="R_{wp} < 5\%" />.
            </p>

            {/* 11 */}
            <h3>11. Параметры модели и единицы измерения</h3>
            <table class="help-table">
              <thead>
                <tr><th>Параметр</th><th>Обозначение</th><th>Единицы</th><th>Описание</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>Tfus_A</code></td>
                  <td><Katex math="T_{\mathrm{fus},A}" /></td>
                  <td>К</td>
                  <td>Температура плавления чистого A</td>
                </tr>
                <tr>
                  <td><code>dHfus_A</code></td>
                  <td><Katex math="\Delta H_{\mathrm{fus},A}" /></td>
                  <td>Дж/моль</td>
                  <td>Энтальпия плавления A</td>
                </tr>
                <tr>
                  <td><code>Tfus_B</code></td>
                  <td><Katex math="T_{\mathrm{fus},B}" /></td>
                  <td>К</td>
                  <td>Температура плавления чистого B</td>
                </tr>
                <tr>
                  <td><code>dHfus_B</code></td>
                  <td><Katex math="\Delta H_{\mathrm{fus},B}" /></td>
                  <td>Дж/моль</td>
                  <td>Энтальпия плавления B</td>
                </tr>
                <tr>
                  <td><code>L{'{v}'}_H</code></td>
                  <td><Katex math="L_v^H" /></td>
                  <td>Дж/моль</td>
                  <td>Энтальпийный параметр РК порядка <Katex math="v" /></td>
                </tr>
                <tr>
                  <td><code>L{'{v}'}_S</code></td>
                  <td><Katex math="L_v^S" /></td>
                  <td>Дж/(моль·К)</td>
                  <td>Энтропийный параметр РК порядка <Katex math="v" /></td>
                </tr>
                <tr>
                  <td><code>Ttrans_A_{'{k}'}</code></td>
                  <td><Katex math="T_{\mathrm{tr},A,k}" /></td>
                  <td>К</td>
                  <td>Температура <Katex math="k" />-го перехода A</td>
                </tr>
                <tr>
                  <td><code>dHtrans_A_{'{k}'}</code></td>
                  <td><Katex math="\Delta H_{\mathrm{tr},A,k}" /></td>
                  <td>Дж/моль</td>
                  <td>Энтальпия <Katex math="k" />-го перехода A</td>
                </tr>
                <tr>
                  <td><code>Ttrans_B_{'{k}'}</code></td>
                  <td><Katex math="T_{\mathrm{tr},B,k}" /></td>
                  <td>К</td>
                  <td>Температура <Katex math="k" />-го перехода B</td>
                </tr>
                <tr>
                  <td><code>dHtrans_B_{'{k}'}</code></td>
                  <td><Katex math="\Delta H_{\mathrm{tr},B,k}" /></td>
                  <td>Дж/моль</td>
                  <td>Энтальпия <Katex math="k" />-го перехода B</td>
                </tr>
              </tbody>
            </table>

            {/* 12 */}
            <h3>12. Воспроизведение расчёта в сторонних программах</h3>
            <p>
              Алгоритм для реализации в Python (numpy/scipy) или любой другой среде:
            </p>
            <ol>
              <li>
                Задать начальные значения&nbsp;
                <Katex math="T_{\mathrm{fus}}, \Delta H_{\mathrm{fus}}, L_v^H, L_v^S" />.
              </li>
              <li>
                Для каждого состава&nbsp;<Katex math="x_B" /> вычислить&nbsp;
                <Katex math="T_A(x_B)" /> и&nbsp;<Katex math="T_B(x_B)" /> по
                формуле раздела 4, используя парциальные функции раздела 5.
              </li>
              <li>
                Линия ликвидуса:&nbsp;
                <Katex math="T_{\mathrm{liq}}(x_B) = \max[T_A(x_B), T_B(x_B)]" />.
              </li>
              <li>
                Минимизировать&nbsp;<Katex math="\chi^2" /> (раздел 7) по свободным
                параметрам с помощью&nbsp;
                <code>scipy.optimize.least_squares(method='lm')</code>.
              </li>
              <li>
                Ковариационную матрицу получить из&nbsp;
                <Katex math="(\mathbf{J}^T\mathbf{W}\mathbf{J})^{-1}\hat\sigma^2" />
                &nbsp;(раздел 9), где&nbsp;<Katex math="\mathbf{J}" /> — матрица Якоби
                из результата <code>least_squares</code>.
              </li>
            </ol>

          </div>
        </div>
      </div>
    </Show>
  );
};
