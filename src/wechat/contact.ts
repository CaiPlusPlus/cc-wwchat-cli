import type { OpenClawContact, OpenClawGroup } from '../openclaw/types.js';

export interface WeChatContact {
  id: string;
  name: string;
  avatar?: string;
  type: 'user' | 'group';
}

export interface WeChatGroup {
  id: string;
  name: string;
  memberCount: number;
  avatar?: string;
}

export function fromOpenClawContact(contact: OpenClawContact): WeChatContact {
  return {
    id: contact.id,
    name: contact.name,
    avatar: contact.avatar,
    type: contact.type === 'group' ? 'group' : 'user',
  };
}

export function fromOpenClawGroup(group: OpenClawGroup): WeChatGroup {
  return {
    id: group.id,
    name: group.name,
    memberCount: group.memberCount,
    avatar: group.avatar,
  };
}
