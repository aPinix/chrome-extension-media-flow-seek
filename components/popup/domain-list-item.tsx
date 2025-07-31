import { CheckIcon, GlobeIcon, Trash2Icon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  DomainConfigT,
  DomainRuleTypeE,
  DomainRuleTypeT,
} from '@/types/domains';

interface DomainListItemPropsI {
  rule: DomainConfigT;
  isGlobal?: boolean;
  isCurrentDomain?: boolean;
  onToggleEnabled?: (domain: string) => void;
  onToggleRuleType: (domain: string, currentType: DomainRuleTypeT) => void;
  onRemove?: (domain: string) => void;
}

export const DomainListItem = ({
  rule,
  isGlobal,
  isCurrentDomain,
  onToggleEnabled,
  onToggleRuleType,
  onRemove,
}: DomainListItemPropsI) => {
  const getTitle = () => {
    if (isGlobal) {
      return 'All Websites (global)';
    }
    return rule.domain;
  };

  const getDescription = () => {
    if (isGlobal) {
      return rule.type === DomainRuleTypeE.Whitelist
        ? 'Whitelisted'
        : 'Blacklisted';
    }

    if (!rule.enabled) {
      return 'Rule disabled';
    }

    return rule.type === DomainRuleTypeE.Whitelist
      ? 'Extension enabled'
      : 'Extension disabled';
  };

  return (
    <div className="py-1">
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border p-3 shadow-sm backdrop-blur-sm transition-all hover:shadow-md',
          rule.type === DomainRuleTypeE.Whitelist
            ? 'border-green-200 bg-green-50/80 dark:border-green-800/50 dark:bg-green-900/20'
            : 'border-red-200 bg-red-50/80 dark:border-red-800/50 dark:bg-red-900/20',
          !isGlobal && !rule.enabled && 'opacity-50'
        )}
      >
        {/* Top Row: Switch, Favicon, Title, Delete Button */}
        <div className="flex items-center gap-3">
          {/* Enable/Disable Switch (only for non-global) */}
          {!isGlobal && onToggleEnabled ? (
            <Switch
              checked={rule.enabled}
              onCheckedChange={() => onToggleEnabled(rule.domain)}
            />
          ) : null}

          {/* Domain Favicon */}
          <div className="flex-shrink-0">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800/50">
              {isGlobal ? (
                <GlobeIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <>
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${rule.domain}&sz=32`}
                    alt={`${rule.domain} favicon`}
                    className="h-5 w-5 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      fallback.style.display = 'flex';
                    }}
                  />
                  <div className="hidden">
                    <GlobeIcon className="hidden h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Domain Title */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {getTitle()}
              </span>
              {!isGlobal && isCurrentDomain && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                  Current
                </span>
              )}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {getDescription()}
            </span>
          </div>

          {/* Action Buttons (only for non-global) */}
          {!isGlobal && onRemove ? (
            <div className="flex items-center gap-1">
              {/* Delete Button */}
              {onRemove ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(rule.domain)}
                  className="h-8 w-8 p-0 text-red-500 transition-transform hover:scale-110 hover:bg-red-100 dark:hover:bg-red-900/30"
                  title="Remove domain"
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Bottom Row: Whitelist/Blacklist Actions */}
        <div className="flex justify-center gap-2">
          {/* Whitelist Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (rule.type !== DomainRuleTypeE.Whitelist) {
                onToggleRuleType(rule.domain, rule.type);
              }
            }}
            disabled={!isGlobal && !rule.enabled}
            className={cn(
              'h-8 px-4 text-xs font-medium transition-all',
              rule.type === DomainRuleTypeE.Whitelist
                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                : 'text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/20 dark:hover:text-green-300'
            )}
            title="Set to whitelist (enable extension)"
          >
            <CheckIcon className="mr-1 h-3 w-3" />
            Whitelist
          </Button>

          {/* Blacklist Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (rule.type !== DomainRuleTypeE.Blacklist) {
                onToggleRuleType(rule.domain, rule.type);
              }
            }}
            disabled={!isGlobal && !rule.enabled}
            className={cn(
              'h-8 px-4 text-xs font-medium transition-all',
              rule.type === DomainRuleTypeE.Blacklist
                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60'
                : 'text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300'
            )}
            title="Set to blacklist (disable extension)"
          >
            <XIcon className="mr-1 h-3 w-3" />
            Blacklist
          </Button>
        </div>
      </div>
    </div>
  );
};
