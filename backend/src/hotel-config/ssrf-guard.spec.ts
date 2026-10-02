import { lookup } from 'dns/promises';
import type { LookupAddress } from 'dns';
import { assertSafeUrl, isBlockedIp } from './ssrf-guard';

jest.mock('dns/promises');
// `lookup` có nhiều overload (trả 1 địa chỉ hoặc mảng tuỳ tham số) — ép về đúng chữ ký
// { all: true } mà ssrf-guard.ts dùng, để mockResolvedValue nhận được mảng LookupAddress[].
type LookupAllFn = (
  hostname: string,
  options: { all: true },
) => Promise<LookupAddress[]>;
const mockedLookup = lookup as unknown as jest.MockedFunction<LookupAllFn>;

describe('ssrf-guard', () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  describe('isBlockedIp', () => {
    it.each([
      ['169.254.169.254', true], // link-local / metadata cloud
      ['127.0.0.1', true],
      ['0.0.0.0', true],
      ['10.0.0.5', true],
      ['100.64.0.1', true], // CGNAT
      ['192.168.1.1', true],
      ['172.20.0.1', true], // trong dải 172.16.0.0/12
      ['172.15.0.1', false], // NGOÀI dải 172.16-31, phải cho qua
      ['172.32.0.1', false], // NGOÀI dải 172.16-31, phải cho qua
      ['8.8.8.8', false],
      ['203.0.113.10', false],
    ])('IPv4 %s -> blocked=%s', (ip, expected) => {
      expect(isBlockedIp(ip)).toBe(expected);
    });

    it.each([
      ['::1', true],
      ['[::1]', true], // vẫn nhận dạng có ngoặc vuông giống URL.hostname trả về
      ['::', true],
      ['fe80::1', true], // link-local IPv6
      ['fc00::1', true], // unique local IPv6
      ['::ffff:127.0.0.1', true], // IPv4-mapped dạng chấm
      ['::ffff:7f00:1', true], // IPv4-mapped dạng hex mà new URL() thường chuẩn hoá về
      ['[::ffff:127.0.0.1]', true],
      ['::ffff:169.254.169.254', true], // metadata cloud dạng mapped
      ['2001:4860:4860::8888', false], // Google public DNS — IPv6 công khai
      ['::ffff:8.8.8.8', false], // mapped nhưng đích là IPv4 công khai
    ])('IPv6 %s -> blocked=%s', (ip, expected) => {
      expect(isBlockedIp(ip)).toBe(expected);
    });
  });

  describe('assertSafeUrl', () => {
    it('từ chối giao thức khác http/https', async () => {
      await expect(assertSafeUrl('ftp://example.com/file')).rejects.toThrow(
        'Chỉ hỗ trợ link http hoặc https.',
      );
    });

    it('từ chối link không hợp lệ', async () => {
      await expect(assertSafeUrl('not-a-url')).rejects.toThrow(
        'Link không hợp lệ.',
      );
    });

    it('từ chối 169.254.169.254 (cloud metadata)', async () => {
      await expect(
        assertSafeUrl('http://169.254.169.254/latest/meta-data'),
      ).rejects.toThrow('Không được phép trích xuất từ địa chỉ nội bộ.');
    });

    it('từ chối [::1]', async () => {
      await expect(assertSafeUrl('http://[::1]/')).rejects.toThrow(
        'Không được phép trích xuất từ địa chỉ nội bộ.',
      );
    });

    it('từ chối [::ffff:127.0.0.1] (IPv4-mapped IPv6)', async () => {
      await expect(assertSafeUrl('http://[::ffff:127.0.0.1]/')).rejects.toThrow(
        'Không được phép trích xuất từ địa chỉ nội bộ.',
      );
    });

    it('từ chối 127.0.0.1', async () => {
      await expect(assertSafeUrl('http://127.0.0.1/')).rejects.toThrow(
        'Không được phép trích xuất từ địa chỉ nội bộ.',
      );
    });

    it('từ chối 10.x', async () => {
      await expect(assertSafeUrl('http://10.1.2.3/')).rejects.toThrow(
        'Không được phép trích xuất từ địa chỉ nội bộ.',
      );
    });

    it('từ chối 192.168.x', async () => {
      await expect(assertSafeUrl('http://192.168.0.5/')).rejects.toThrow(
        'Không được phép trích xuất từ địa chỉ nội bộ.',
      );
    });

    it('từ chối 172.16-31.x', async () => {
      await expect(assertSafeUrl('http://172.20.5.5/')).rejects.toThrow(
        'Không được phép trích xuất từ địa chỉ nội bộ.',
      );
    });

    it('từ chối localhost (phân giải DNS về loopback)', async () => {
      mockedLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      await expect(assertSafeUrl('http://localhost/')).rejects.toThrow(
        'Không được phép trích xuất từ địa chỉ nội bộ.',
      );
    });

    it('từ chối domain công khai nhưng phân giải về 127.0.0.1 (mock dns.lookup)', async () => {
      mockedLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      await expect(
        assertSafeUrl('http://looks-public.example.com/'),
      ).rejects.toThrow('Không được phép trích xuất từ địa chỉ nội bộ.');
    });

    it('từ chối khi chỉ MỘT trong nhiều bản ghi DNS trỏ vào nội bộ', async () => {
      mockedLookup.mockResolvedValue([
        { address: '203.0.113.10', family: 4 },
        { address: '10.0.0.5', family: 4 },
      ]);
      await expect(
        assertSafeUrl('http://multi-a-record.example.com/'),
      ).rejects.toThrow('Không được phép trích xuất từ địa chỉ nội bộ.');
    });

    it('cho qua URL công khai hợp lệ', async () => {
      mockedLookup.mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
      const result = await assertSafeUrl('https://example.com/events');
      expect(result.hostname).toBe('example.com');
    });
  });
});
