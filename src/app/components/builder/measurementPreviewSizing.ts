export const GARMENT_PREVIEW_CONTAINER_CLASS =
  'relative flex h-full w-full min-h-0 [container-type:size] items-center justify-center';

export const GARMENT_PREVIEW_CANVAS_CLASS =
  'relative aspect-square h-[min(100cqh,100cqw)] w-[min(100cqh,100cqw)] shrink-0';

/** Step 1 diagram: a bit smaller on phone so the form gets more vertical room. */
export const MEASUREMENT_GUIDE_CLASS_PHONE =
  'relative z-[1] mx-auto block h-auto w-auto max-h-[min(40dvh,280px)] max-w-[min(100%,85vw,320px)] shrink-0 object-contain';

/** Tablet/desktop: capped height so the guide does not dominate very tall viewports. */
export const PREVIEW_STAGE_CLASS =
  'relative z-[1] mx-auto h-auto w-full max-w-[min(100%,300px)] max-h-[min(50dvh,380px)] object-contain md:h-full md:max-h-[min(38vh,340px)] md:max-w-[min(100%,360px)] lg:max-h-[min(42vh,400px)] lg:max-w-[min(100%,400px)] xl:max-h-[min(46vh,460px)] xl:max-w-[min(100%,440px)] 2xl:max-h-[min(52vh,540px)] 2xl:max-w-[min(100%,480px)]';
