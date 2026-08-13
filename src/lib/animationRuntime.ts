import {animate as animeAnimate} from 'animejs';
import {gsap} from 'gsap';
import {animate as motionAnimate} from 'motion';
import type {AnimationDirection, ImageLayer, Slide, TextLayer, VideoLayer} from '../types';

export function resetAnimationNode(node: HTMLElement | null) {
  if (!node) return;
  gsap.killTweensOf(node);
  node.getAnimations().forEach((animation) => animation.cancel());
  node.className = node.className
    .split(' ')
    .filter((name) => !name.startsWith('animate__'))
    .join(' ');
  node.style.removeProperty('--animate-duration');
  node.style.opacity = '1';
  node.style.transform = 'none';
}

function runCssAnimation(node: HTMLElement, className: string, duration: number) {
  resetAnimationNode(node);
  void node.offsetWidth;
  node.style.setProperty('--animate-duration', `${duration}s`);
  node.classList.add('animate__animated', className);
}

function runFallback(node: HTMLElement, entering: boolean, duration: number) {
  resetAnimationNode(node);
  node.animate(
    entering
      ? [{opacity: 0, transform: 'scale(.75)'}, {opacity: 1, transform: 'scale(1)'}]
      : [{opacity: 1, transform: 'scale(1)'}, {opacity: 0, transform: 'scale(.75)'}],
    {duration: duration * 1000, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards'}
  );
}

function playMediaAnimation(
  root: HTMLElement,
  media: Pick<ImageLayer, 'id' | 'entrance' | 'exit' | 'animationDuration'>,
  direction: AnimationDirection,
  selector: string
) {
  const node = root.querySelector<HTMLElement>(`${selector}[data-id="${media.id}"]`);
  if (!node) return;
  const name = direction === 'entrance' ? media.entrance : media.exit;
  const duration = Math.max(0.2, media.animationDuration || 0.8);
  const entering = direction === 'entrance';
  if (name === 'none') {
    if (entering) resetAnimationNode(node);
    return;
  }

  resetAnimationNode(node);
  const gsapPresets: Record<string, {from?: gsap.TweenVars; to: gsap.TweenVars}> = {
    'gsap-zoom': {from: {opacity: 0, scale: 1.38}, to: {opacity: 1, scale: 1, ease: 'power3.out'}},
    'gsap-rotate': {from: {opacity: 0, scale: 0.62, rotation: -18}, to: {opacity: 1, scale: 1, rotation: 0, ease: 'back.out(1.7)'}},
    'gsap-zoom-out': {to: {opacity: 0, scale: 0.62, ease: 'power3.in'}},
    'gsap-rotate-out': {to: {opacity: 0, scale: 0.7, rotation: 22, ease: 'back.in(1.5)'}}
  };
  if (gsapPresets[name]) {
    const preset = gsapPresets[name];
    if (preset.from) gsap.fromTo(node, preset.from, {...preset.to, duration});
    else gsap.to(node, {...preset.to, duration});
    return;
  }

  const animePresets: Record<string, Record<string, unknown>> = {
    'anime-elastic': {opacity: [0, 1], scale: [0.55, 1], duration: duration * 1000, ease: 'outElastic(1, .65)'},
    'anime-swing': {opacity: [0, 1], rotate: ['-16deg', '0deg'], translateX: ['-28%', '0%'], duration: duration * 1000, ease: 'outExpo'},
    'anime-collapse': {opacity: [1, 0], scaleX: [1, 0.05], scaleY: [1, 0.7], duration: duration * 1000, ease: 'inExpo'},
    'anime-swing-out': {opacity: [1, 0], rotate: ['0deg', '18deg'], translateX: ['0%', '35%'], duration: duration * 1000, ease: 'inBack'}
  };
  if (animePresets[name]) {
    animeAnimate(node, animePresets[name] as never);
    return;
  }

  const cssPresets: Record<string, string> = {
    'animate-bounce': 'animate__bounceIn',
    'animate-flip': 'animate__flipInY',
    'animate-bounce-out': 'animate__bounceOut',
    'animate-flip-out': 'animate__flipOutY'
  };
  if (cssPresets[name]) {
    runCssAnimation(node, cssPresets[name], duration);
    return;
  }

  const motionPresets: Record<string, Record<string, Array<string | number>>> = {
    'motion-spring': {opacity: [0, 1], transform: ['translateY(24%) scale(.82)', 'translateY(0) scale(1)']},
    'motion-slide': {opacity: [0, 1], transform: ['translateX(75%) skewX(-8deg)', 'translateX(0) skewX(0)']},
    'motion-drop': {opacity: [1, 0], transform: ['translateY(0) scale(1)', 'translateY(45%) scale(.86)']},
    'motion-slide-out': {opacity: [1, 0], transform: ['translateX(0)', 'translateX(-78%) skewX(8deg)']}
  };
  if (motionPresets[name]) {
    motionAnimate(node, motionPresets[name], {
      duration,
      type: entering ? 'spring' : 'tween',
      bounce: entering ? 0.38 : 0,
      ease: entering ? 'easeOut' : 'easeIn'
    });
    return;
  }

  runFallback(node, entering, duration);
}

export function playImageAnimation(root: HTMLElement, image: ImageLayer, direction: AnimationDirection) {
  playMediaAnimation(root, image, direction, '.stage-image');
}

export function playVideoAnimation(root: HTMLElement, video: VideoLayer, direction: AnimationDirection) {
  playMediaAnimation(root, video, direction, '.stage-video');
}

export function playLinkedTextAnimation(
  root: HTMLElement,
  text: TextLayer,
  image: ImageLayer,
  direction: AnimationDirection
) {
  const node = root.querySelector<HTMLElement>(`.text-item[data-id="${text.id}"]`);
  if (!node) return;
  node.getAnimations().forEach((animation) => animation.cancel());
  const base = 'translate(-50%, -50%)';
  const entranceFrames: Partial<Record<ImageLayer['entrance'], Keyframe[]>> = {
    'gsap-zoom': [{opacity: 0, transform: `${base} scale(1.38)`}, {opacity: 1, transform: `${base} scale(1)`}],
    'gsap-rotate': [{opacity: 0, transform: `${base} scale(.62) rotate(-18deg)`}, {opacity: 1, transform: `${base} scale(1) rotate(0)`}],
    'anime-elastic': [{opacity: 0, transform: `${base} scale(.55)`}, {opacity: 1, transform: `${base} scale(1.08)`, offset: 0.76}, {opacity: 1, transform: `${base} scale(1)`}],
    'anime-swing': [{opacity: 0, transform: `${base} translateX(-28%) rotate(-16deg)`}, {opacity: 1, transform: `${base} translateX(0) rotate(0)`}],
    'animate-bounce': [{opacity: 0, transform: `${base} translateY(-24%)`}, {opacity: 1, transform: `${base} translateY(5%)`, offset: 0.72}, {opacity: 1, transform: base}],
    'animate-flip': [{opacity: 0, transform: `${base} scaleX(.05)`}, {opacity: 1, transform: `${base} scaleX(1)`}],
    'motion-spring': [{opacity: 0, transform: `${base} translateY(24%) scale(.82)`}, {opacity: 1, transform: `${base} translateY(0) scale(1)`}],
    'motion-slide': [{opacity: 0, transform: `${base} translateX(75%)`}, {opacity: 1, transform: `${base} translateX(0)`}]
  };
  const exitFrames: Partial<Record<ImageLayer['exit'], Keyframe[]>> = {
    'gsap-zoom-out': [{opacity: 1, transform: `${base} scale(1)`}, {opacity: 0, transform: `${base} scale(.62)`}],
    'gsap-rotate-out': [{opacity: 1, transform: `${base} scale(1)`}, {opacity: 0, transform: `${base} scale(.7) rotate(22deg)`}],
    'anime-collapse': [{opacity: 1, transform: `${base} scale(1)`}, {opacity: 0, transform: `${base} scale(.08, .7)`}],
    'anime-swing-out': [{opacity: 1, transform: base}, {opacity: 0, transform: `${base} translateX(35%) rotate(18deg)`}],
    'animate-bounce-out': [{opacity: 1, transform: base}, {opacity: 0, transform: `${base} translateY(32%)`}],
    'animate-flip-out': [{opacity: 1, transform: `${base} scaleX(1)`}, {opacity: 0, transform: `${base} scaleX(.05)`}],
    'motion-drop': [{opacity: 1, transform: `${base} scale(1)`}, {opacity: 0, transform: `${base} translateY(45%) scale(.86)`}],
    'motion-slide-out': [{opacity: 1, transform: base}, {opacity: 0, transform: `${base} translateX(-78%)`}]
  };
  const frames = direction === 'entrance' ? entranceFrames[image.entrance] : exitFrames[image.exit];
  node.animate(frames || (direction === 'entrance'
    ? [{opacity: 0, transform: `${base} scale(.8)`}, {opacity: 1, transform: base}]
    : [{opacity: 1, transform: base}, {opacity: 0, transform: `${base} scale(.8)`}]), {
    duration: Math.max(0.2, image.animationDuration || 0.8) * 1000,
    easing: direction === 'entrance' ? 'cubic-bezier(.22,1,.36,1)' : 'cubic-bezier(.55,0,1,.45)',
    fill: 'forwards'
  });
}

export function playSlideTransition(root: HTMLElement, slide: Slide) {
  const duration = Math.max(0.2, slide.transitionDuration || 0.7);
  resetAnimationNode(root);
  if (slide.transition === 'none') return;
  if (slide.transition === 'gsap-fade') {
    gsap.fromTo(root, {opacity: 0, scale: 1.04}, {opacity: 1, scale: 1, duration, ease: 'power2.out'});
    return;
  }
  if (slide.transition === 'anime-slide') {
    animeAnimate(root, {opacity: [0, 1], translateX: ['14%', '0%'], duration: duration * 1000, ease: 'outExpo'});
    return;
  }
  if (slide.transition === 'animate-flip') {
    runCssAnimation(root, 'animate__flipInY', duration);
    return;
  }
  if (slide.transition === 'motion-zoom') {
    motionAnimate(root, {opacity: [0, 1], transform: ['scale(1.16)', 'scale(1)']}, {duration, ease: [0.22, 1, 0.36, 1]});
    return;
  }
  runFallback(root, true, duration);
}

export function resetStageAnimations(root: HTMLElement) {
  resetAnimationNode(root);
  root.querySelectorAll<HTMLElement>('.stage-image').forEach(resetAnimationNode);
  root.querySelectorAll<HTMLElement>('.stage-video').forEach(resetAnimationNode);
  root.querySelectorAll<HTMLElement>('.linked-text').forEach((node) => {
    node.getAnimations().forEach((animation) => animation.cancel());
    node.style.removeProperty('opacity');
    node.style.removeProperty('transform');
  });
}
