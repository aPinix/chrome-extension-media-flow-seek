import { parse } from 'tldts';

import { parseSiteRuleTarget } from '@/helpers/domains';

interface DomainNamePropsI {
  domain: string;
  searchQuery?: string;
}

export function DomainName({ domain, searchQuery }: DomainNamePropsI) {
  const target = parseSiteRuleTarget(domain);
  const hostname = target?.hostname ?? domain;
  const publicSuffix = parse(hostname).publicSuffix;
  const suffix = publicSuffix ? `.${publicSuffix}` : '';
  const name = suffix ? hostname.slice(0, -suffix.length) : hostname;

  const highlight = (text: string) => {
    const term = searchQuery?.trim().toLowerCase();
    if (!term) return text;
    const parts = [];
    let offset = 0;
    let index = text.toLowerCase().indexOf(term);
    while (index !== -1) {
      parts.push(text.slice(offset, index));
      parts.push(<mark key={index} className="rounded-sm bg-[#F3CD45] text-neutral-900">{text.slice(index, index + term.length)}</mark>);
      offset = index + term.length;
      index = text.toLowerCase().indexOf(term, offset);
    }
    parts.push(text.slice(offset));
    return parts;
  };
  if (searchQuery?.trim()) return <>{highlight(domain)}</>;
  return (
    <>
      <span>{name}</span>
      {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
      {target?.port ? <span>:{target.port}</span> : null}
      {target?.suffix ? <span>{target.suffix}</span> : null}
    </>
  );
}
