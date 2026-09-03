import { parse } from 'tldts';

import { parseSiteRuleTarget } from '@/helpers/domains';

interface DomainNamePropsI {
  domain: string;
}

export function DomainName({ domain }: DomainNamePropsI) {
  const target = parseSiteRuleTarget(domain);
  const hostname = target?.hostname ?? domain;
  const publicSuffix = parse(hostname).publicSuffix;
  const suffix = publicSuffix ? `.${publicSuffix}` : '';
  const name = suffix ? hostname.slice(0, -suffix.length) : hostname;

  return (
    <>
      <span>{name}</span>
      {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
      {target?.port ? <span>:{target.port}</span> : null}
      {target?.suffix ? <span>{target.suffix}</span> : null}
    </>
  );
}
