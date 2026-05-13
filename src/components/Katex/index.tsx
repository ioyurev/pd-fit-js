import { onMount, createEffect } from 'solid-js';
import type { Component } from 'solid-js';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface KatexProps {
  math: string;
  display?: boolean;
  class?: string;
}

export const Katex: Component<KatexProps> = (props) => {
  let ref!: HTMLSpanElement;

  const render = () => {
    try {
      katex.render(props.math, ref, {
        displayMode: props.display ?? false,
        throwOnError: false,
      });
    } catch (e) {
      ref.textContent = props.math;
    }
  };

  onMount(render);
  createEffect(render);

  return <span ref={ref} class={props.class} />;
};
