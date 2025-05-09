import {KVMeta, Metadata} from "../../utils/types.ts";

export interface IMetadataRepository {
  create(data: Metadata): Promise<boolean>;
  getByFkey(fkey: string): Promise<Metadata | null>;
  list(limit?: number, offset?: number): Promise<Metadata[]>;
  update(fkey: string, patch: Partial<Metadata>): Promise<boolean>;
  delete(fkey: string): Promise<boolean>;
  findByMime(mime: string): Promise<Metadata[]>;
  getActiveMetas(): Promise<KVMeta[]>;
  /**
   * 获取指定邮箱的全部 fkey
   */
  getByEmailAllFkeys(email: string): Promise<string[]>;
  /**
   * 普通用户分页查询
   */
  paginateByEmail(
    email: string,
    limit?: number,
    offset?: number,
  ): Promise<{ items: Omit<Metadata, 'content'>[]; total: number }>;
  /**
   * 管理员分页查询
   */
  listAlive(
    limit?: number,
    offset?: number,
  ): Promise<{ items: Omit<Metadata, 'content'>[]; total: number }>;
}