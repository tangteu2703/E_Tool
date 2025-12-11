# Chrome Extension - Auto Social Media Automation

Extension Chrome tự động hóa các thao tác trên mạng xã hội Facebook.

## Tính năng

- ✅ Tự động lướt bảng tin
- ✅ Tự động Like bài viết hàng loạt
- ✅ Tự động Comment bài viết với danh sách comment tùy chỉnh
- ✅ Tự động tìm kiếm và kết bạn
- ✅ Điều chỉnh tốc độ thao tác
- ✅ Giới hạn số lượng thao tác
- ✅ Thống kê số lượng likes, comments, friends

## Cài đặt

1. Mở Chrome và vào `chrome://extensions/`
2. Bật "Developer mode" (góc trên bên phải)
3. Click "Load unpacked"
4. Chọn thư mục chứa extension này
5. Extension sẽ xuất hiện trong thanh công cụ

## Sử dụng

1. Mở Facebook trong tab Chrome
2. Click vào icon extension
3. Cấu hình các tùy chọn:
   - Chọn các tính năng muốn sử dụng
   - Nhập danh sách comment (mỗi dòng 1 comment)
   - Nhập từ khóa tìm kiếm (nếu dùng tính năng kết bạn)
   - Điều chỉnh tốc độ và số lượng thao tác
4. Click "Bắt đầu" để khởi động
5. Click "Dừng" để dừng automation

## Lưu ý

⚠️ **Cảnh báo**: Extension này chỉ dùng cho mục đích học tập và nghiên cứu. Việc sử dụng tự động hóa có thể vi phạm điều khoản sử dụng của Facebook. Người dùng chịu trách nhiệm về việc sử dụng extension này.

## Cấu trúc file

- `manifest.json` - Cấu hình extension
- `popup.html` - Giao diện popup
- `popup.js` - Logic điều khiển popup
- `content.js` - Script tự động hóa chạy trên trang web
- `background.js` - Service worker nền
- `styles.css` - Styling cho popup
- `icon.png` - Icon extension (cần thêm file này)

## Tùy chỉnh

Bạn có thể tùy chỉnh các selector trong `content.js` để phù hợp với giao diện mới của Facebook hoặc các mạng xã hội khác.

