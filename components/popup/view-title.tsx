interface ViewTitlePropsI {
  description: string;
  title: string;
}

export function ViewTitle({ description, title }: ViewTitlePropsI) {
  return (
    <header className="flex flex-col gap-1 px-1">
      <h1 className="font-bold text-slate-950 text-xl leading-tight dark:text-white">
        {title}
      </h1>
      <p className="text-slate-500 text-xs leading-relaxed dark:text-slate-400">
        {description}
      </p>
    </header>
  );
}
