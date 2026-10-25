import {
  adminPlaceInputSchema,
  type AdminPlaceInput,
  type AdminPlaceDto,
} from '@goease/contracts';

/** Read-only hint; publishing still repeats every check against current revisions. */
export function publicationReadiness(
  input: AdminPlaceInput,
  context: {
    destinationVisible: boolean;
    archiving: boolean;
    blockingKind: 'source' | 'duplicate' | null;
    closedUnconfirmed: boolean;
    staleProposal: boolean;
    alreadyPublished: boolean;
  },
): NonNullable<AdminPlaceDto['publicationReadiness']> {
  const blocked = (label: string) => ({ ready: false, label });
  if (context.alreadyPublished) return blocked('Đang công khai');
  if (!context.destinationVisible) return blocked('Tỉnh/thành chưa bật');
  if (context.archiving) return blocked('Phạm vi đang lưu trữ');
  if (context.staleProposal) return blocked('Đề xuất cần đối chiếu lại');
  if (context.blockingKind)
    return blocked(
      context.blockingKind === 'duplicate'
        ? 'Có thể trùng địa điểm'
        : 'Cần đối chiếu nguồn',
    );
  if (context.closedUnconfirmed) return blocked('Cần xác minh đóng cửa');
  if (input.images?.[0]?.storage === 'source')
    return blocked('Cần lưu ảnh bìa lên Cloudinary');
  const checked = adminPlaceInputSchema.safeParse({
    ...input,
    publicationStatus: 'published',
  });
  if (!checked.success) {
    const labels: Record<string, string> = {
      visitInfo: 'Cần kiểm tra giờ và giá',
      images: 'Thiếu ảnh bìa hợp lệ',
      description: 'Thiếu giới thiệu',
      name: 'Cần kiểm tra tên',
      locationQuery: 'Thiếu địa chỉ',
      sourceUrl: 'Thiếu nguồn hợp lệ',
      durationMinutes: 'Cần kiểm tra thời lượng',
      referencePrice: 'Giá chưa hợp lệ',
      openingHoursNote: 'Cần kiểm tra giờ mở cửa',
    };
    const issue = checked.error.issues[0]!;
    return blocked(labels[String(issue.path[0])] ?? 'Cần bổ sung thông tin');
  }
  return { ready: true, label: 'Đủ để xuất bản' };
}
