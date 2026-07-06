// GENERATED FILE, DO NOT EDIT!!!
/* eslint-disable @typescript-eslint/no-explicit-any */

import OpenMowerBaseRpc from './rpc-base';

export type StringDoaGddGA = string;
/**
 *
 * Content of a YAML file as a string
 *
 */
export type StringXJCrhoiv = string;
export type NumberHo1ClIqD = number;
export interface ObjectOfNumberHo1ClIqDStringDoaGddGALG8TMFRt {
  name: StringDoaGddGA;
  size: NumberHo1ClIqD;
  [k: string]: any;
}
export type UnorderedSetOfObjectOfNumberHo1ClIqDStringDoaGddGALG8TMFRtjAx5GKqv = ObjectOfNumberHo1ClIqDStringDoaGddGALG8TMFRt[];
export type BooleanVyG3AETh = boolean;
export interface ObjectHAgrRKSz { [key: string]: any; }
export type StringZDJW5SIj = "pong";
export type UnorderedSetOfStringDoaGddGADvj0XlFa = StringDoaGddGA[];
export type NullQu0Arl1F = null;
/**
 *
 * Keys are relative file paths, values are YAML file contents as strings
 *
 */
export interface ObjectHicl3T4F { [key: string]: any; }
export interface ObjectOfUnorderedSetOfObjectOfNumberHo1ClIqDStringDoaGddGALG8TMFRtjAx5GKqv3GMmcQyp {
  files: UnorderedSetOfObjectOfNumberHo1ClIqDStringDoaGddGALG8TMFRtjAx5GKqv;
  [k: string]: any;
}
export interface ObjectOfBooleanVyG3AEThJlPixWl2 {
  ok: BooleanVyG3AETh;
  [k: string]: any;
}
export interface ObjectOfBooleanVyG3AEThNumberHo1ClIqDPgcv2SGw {
  ok: BooleanVyG3AETh;
  bytes: NumberHo1ClIqD;
  [k: string]: any;
}
/**
 *
 * Generated! Represents an alias to any of the provided schemas
 *
 */
export type AnyOfObjectHAgrRKSzStringDoaGddGAStringDoaGddGAStringDoaGddGAStringDoaGddGAStringZDJW5SIjUnorderedSetOfStringDoaGddGADvj0XlFaNullQu0Arl1FStringZDJW5SIjStringDoaGddGAObjectHicl3T4FObjectOfUnorderedSetOfObjectOfNumberHo1ClIqDStringDoaGddGALG8TMFRtjAx5GKqv3GMmcQypObjectOfBooleanVyG3AEThJlPixWl2ObjectOfBooleanVyG3AEThNumberHo1ClIqDPgcv2SGw = ObjectHAgrRKSz | StringDoaGddGA | StringZDJW5SIj | UnorderedSetOfStringDoaGddGADvj0XlFa | NullQu0Arl1F | ObjectHicl3T4F | ObjectOfUnorderedSetOfObjectOfNumberHo1ClIqDStringDoaGddGALG8TMFRtjAx5GKqv3GMmcQyp | ObjectOfBooleanVyG3AEThJlPixWl2 | ObjectOfBooleanVyG3AEThNumberHo1ClIqDPgcv2SGw;

export class OpenMowerRpc extends OpenMowerBaseRpc {
  rpc = {
    /**
    * Ping the server.
    */
    ping: async (): Promise<StringZDJW5SIj> => this.call('rpc.ping'),
    /**
    * List all available methods.
    */
    methods: async (): Promise<UnorderedSetOfStringDoaGddGADvj0XlFa> => this.call('rpc.methods'),
  };
  map = {
    /**
    * Replace the current map with a new one.
    */
    replace: async (...args: [map: ObjectHAgrRKSz]): Promise<void> => this.call('map.replace', args),
  };
  meta = {
    rpc: {
      /**
      * Ping the meta server.
      */
      ping: async (): Promise<StringZDJW5SIj> => this.call('meta.rpc.ping'),
    },
    config: {
      /**
      * Get the configuration schema.
      */
      schema: async (): Promise<StringDoaGddGA> => this.call('meta.config.schema'),
      /**
      * Get the default configuration values.
      */
      defaults: async (): Promise<ObjectHicl3T4F> => this.call('meta.config.defaults'),
    },
  };
  fs = {
    /**
    * List files in a directory.
    */
    list: async (args: {path: StringDoaGddGA}): Promise<ObjectOfUnorderedSetOfObjectOfNumberHo1ClIqDStringDoaGddGALG8TMFRtjAx5GKqv3GMmcQyp> => this.call('fs.list', args),
    /**
    * Remove a file.
    */
    remove: async (args: {path: StringDoaGddGA}): Promise<ObjectOfBooleanVyG3AEThJlPixWl2> => this.call('fs.remove', args),
    /**
    * Write a file.
    */
    write: async (args: {path: StringDoaGddGA, data: StringDoaGddGA}): Promise<ObjectOfBooleanVyG3AEThNumberHo1ClIqDPgcv2SGw> => this.call('fs.write', args),
  };
}
