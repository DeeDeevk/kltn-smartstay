import { lookup as dnsLookup } from 'dns/promises';
import type { LookupAddress } from 'dns';
import { BlockList, isIP } from 'net';
import { BadRequestException } from '@nestjs/common';

// Dải mạng private/loopback/link-local/CGNAT theo IANA special-purpose registry — mức
// chặn phù hợp cho endpoint trích xuất sự kiện (chỉ admin gọi được, không phải input công
// khai). Mỗi dải IPv4 được thêm 2 lần vào BlockList: 1 lần ở family 'ipv4' (khớp kết quả
// DNS family 4 và IP literal dạng thường), 1 lần ở family 'ipv6' dưới dạng IPv4-mapped
// "::ffff:a.b.c.d/(96+n)" (khớp IP literal viết dạng ::ffff:x.x.x.x — ví dụ
// ::ffff:127.0.0.1, hostname.new URL() có thể chuẩn hoá thành ::ffff:7f00:1 nhưng cùng 1
// giá trị 128-bit nên BlockList vẫn khớp đúng subnet). Một dải IPv4 a.b.c.d/n luôn tương
// đương ::ffff:a.b.c.d/(96+n) vì 96 bit đầu của dạng mapped luôn cố định.
const IPV4_PRIVATE_SUBNETS: Array<[address: string, prefix: number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
];

const IPV6_PRIVATE_SUBNETS: Array<[address: string, prefix: number]> = [
  ['::1', 128],
  ['::', 128],
  ['fc00::', 7],
  ['fe80::', 10],
];

function buildPrivateBlockList(): BlockList {
  const blockList = new BlockList();
  for (const [address, prefix] of IPV4_PRIVATE_SUBNETS) {
    blockList.addSubnet(address, prefix, 'ipv4');
    blockList.addSubnet(`::ffff:${address}`, 96 + prefix, 'ipv6');
  }
  for (const [address, prefix] of IPV6_PRIVATE_SUBNETS) {
    blockList.addSubnet(address, prefix, 'ipv6');
  }
  return blockList;
}

const privateBlockList = buildPrivateBlockList();

// URL.hostname bọc địa chỉ IPv6 trong ngoặc vuông ("[::1]") — BlockList.check() cần địa
// chỉ trần, không có ngoặc.
export function stripIPv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

// Trả true cho cả trường hợp không parse được thành IP hợp lệ — an toàn là ưu tiên, một
// hostname tưởng là IP nhưng sai định dạng thì không có lý do gì để cho qua.
export function isBlockedIp(rawAddress: string): boolean {
  const address = stripIPv6Brackets(rawAddress);
  const family = isIP(address);
  if (family === 4) return privateBlockList.check(address, 'ipv4');
  if (family === 6) return privateBlockList.check(address, 'ipv6');
  return true;
}

export const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

// Kiểm tra đầy đủ 1 URL trước khi fetch: giao thức, rồi phân giải DNS và kiểm tra MỌI địa
// chỉ IP trả về — một hostname có thể có nhiều bản ghi A/AAAA, chỉ cần 1 bản ghi trỏ ra
// ngoài là đủ để qua một vòng kiểm tra chỉ xét địa chỉ đầu tiên, trong khi các bản ghi còn
// lại trỏ vào nội bộ.
//
// LƯU Ý: vẫn còn khoảng hở DNS rebinding giữa lúc kiểm tra ở đây và lúc fetch() thực sự
// phân giải lại DNS để kết nối (TOCTOU — time-of-check to time-of-use). Chấp nhận được vì
// endpoint này chỉ admin gọi được sau khi đăng nhập, không phải input công khai; xử lý
// triệt để đòi hỏi tự dựng kết nối theo IP đã kiểm tra (bỏ qua DNS resolver của fetch),
// không đáng công sức cho mức rủi ro này.
export async function assertSafeUrl(urlStr: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new BadRequestException('Link không hợp lệ.');
  }

  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    throw new BadRequestException('Chỉ hỗ trợ link http hoặc https.');
  }

  const hostname = stripIPv6Brackets(parsed.hostname);

  // Hostname là địa chỉ IP viết thẳng (không phải tên miền) — kiểm tra ngay, không cần DNS.
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new BadRequestException(
        'Không được phép trích xuất từ địa chỉ nội bộ.',
      );
    }
    return parsed;
  }

  let addresses: LookupAddress[];
  try {
    addresses = await dnsLookup(hostname, { all: true });
  } catch {
    throw new BadRequestException('Không phân giải được tên miền này.');
  }

  if (addresses.length === 0 || addresses.some((a) => isBlockedIp(a.address))) {
    throw new BadRequestException(
      'Không được phép trích xuất từ địa chỉ nội bộ.',
    );
  }

  return parsed;
}
