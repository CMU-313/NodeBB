import { CategoryObject } from './category';
import { TagObject } from './tag';
import { UserObjectSlim } from './user';

export type TopicObject =
    TopicObjectSlim & TopicObjectCoreProperties & TopicObjectOptionalProperties;

export type TopicObjectCoreProperties = {
  lastposttime: number;
  category: CategoryObject;
  user: UserObjectSlim;
  teaser: Teaser;
  tags: TagObject[];
  isOwner: boolean;
  ignored: boolean;
  unread: boolean;
  bookmark: number;
  unreplied: boolean;
  icons: string[];
  getTopicsFields(tids: number[], fields: string[]): Promise<TopicObject[]>;
  getTopicField(tid: number, field: string): Promise<keyof TopicObject>;
  getTopicFields(tid: number, fields: string[]): Promise<TopicObject> | null;
  getTopicData(tid: number): Promise<TopicObject>;
  getTopicsData(tids: number[]): Promise<TopicObject[] | Promise<TopicObject>[]>;
  getCategoryData(tid: number): Promise<number[]>;
  setTopicField(tid: number, field: string, value: number): Promise<void>;
  setTopicFields(tid: number, data: number[]): Promise<void>;
  deleteTopicField(tid: number, field: string): Promise<void>;
  deleteTopicFields(tid: number, fields: string[]): Promise<void>;
};

export type TopicObjectOptionalProperties = {
  tid: number;
  thumb: string;
  pinExpiry: number;
  pinExpiryISO: string | number;
  index: number;
};

interface Teaser {
  pid: number;
  uid: number;
  timestamp: number;
  tid: number;
  content: string;
  timestampISO: string;
  user: UserObjectSlim;
  index: number;
}

export type TopicObjectSlim = TopicSlimProperties & TopicSlimOptionalProperties;

export type TopicSlimProperties = {
  tid: number;
  uid: number;
  cid: number;
  title: string;
  slug: string;
  mainPid: number;
  postcount: string;
  viewcount: string;
  postercount: string;
  scheduled: string;
  deleted: string;
  deleterUid: string;
  titleRaw: string;
  locked: string;
  pinned: number;
  timestamp: string;
  timestampISO: number;
  lastposttime: string;
  lastposttimeISO: number;
  pinExpiry: number;
  pinExpiryISO: number | string;
  upvotes: string;
  downvotes: string;
  votes: string;
  teaserPid: number | string;
  thumbs: Thumb[];
};

export type Thumb = {
  id: number;
  name: string;
  url: string;
};

export type TopicSlimOptionalProperties = {
  tid: number;
  numThumbs: number;
};
