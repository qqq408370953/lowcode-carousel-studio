import type {ImageAnimation, SlideTransition} from '../types';

export interface AnimationGroup {
  label: string;
  options: Array<{value: ImageAnimation; label: string}>;
}

export const entranceAnimationGroups: AnimationGroup[] = [
  {label: 'GSAP', options: [{value: 'gsap-zoom', label: '镜头推进'}, {value: 'gsap-rotate', label: '旋转聚焦'}]},
  {label: 'Anime.js', options: [{value: 'anime-elastic', label: '弹性缩放'}, {value: 'anime-swing', label: '摆动入场'}]},
  {label: 'Animate.css', options: [{value: 'animate-bounce', label: '弹跳进入'}, {value: 'animate-flip', label: '翻转进入'}]},
  {label: 'Motion', options: [{value: 'motion-spring', label: '弹簧浮入'}, {value: 'motion-slide', label: '高速侧滑'}]}
];

export const exitAnimationGroups: AnimationGroup[] = [
  {label: 'GSAP', options: [{value: 'gsap-zoom-out', label: '镜头拉远'}, {value: 'gsap-rotate-out', label: '旋转退场'}]},
  {label: 'Anime.js', options: [{value: 'anime-collapse', label: '收束消失'}, {value: 'anime-swing-out', label: '摆动离场'}]},
  {label: 'Animate.css', options: [{value: 'animate-bounce-out', label: '弹跳退出'}, {value: 'animate-flip-out', label: '翻转退出'}]},
  {label: 'Motion', options: [{value: 'motion-drop', label: '下坠离场'}, {value: 'motion-slide-out', label: '高速侧滑'}]}
];

export const transitionOptions: Array<{value: SlideTransition; label: string}> = [
  {value: 'none', label: '无转场'},
  {value: 'gsap-fade', label: 'GSAP · 电影淡入'},
  {value: 'anime-slide', label: 'Anime.js · 横向滑入'},
  {value: 'animate-flip', label: 'Animate.css · 立体翻转'},
  {value: 'motion-zoom', label: 'Motion · 景深缩放'}
];
