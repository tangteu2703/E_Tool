# Hướng Dẫn Cài Đặt và Sử Dụng

## 📦 Cài Đặt Extension

1. **Mở Chrome Extensions**
   - Mở trình duyệt Chrome
   - Vào địa chỉ: `chrome://extensions/`
   - Hoặc: Menu (3 chấm) → More tools → Extensions

2. **Bật Developer Mode**
   - Toggle nút "Developer mode" ở góc trên bên phải
   - Bật sang ON (màu xanh)

3. **Load Extension**
   - Click nút "Load unpacked"
   - Chọn thư mục chứa extension này
   - Extension sẽ xuất hiện trong danh sách

4. **Kiểm tra**
   - Icon extension sẽ xuất hiện trên thanh công cụ Chrome
   - Click vào icon để mở popup

## 🚀 Sử Dụng Nhanh

### Bước 1: Mở Facebook
- Mở tab mới và vào `https://www.facebook.com`
- Đăng nhập vào tài khoản Facebook (nếu chưa)

### Bước 2: Cấu Hình Extension
1. Click vào icon extension trên thanh công cụ
2. Chọn các tính năng muốn sử dụng:
   - ✅ Tự động lướt bảng tin
   - ✅ Tự động Like bài viết
   - ✅ Tự động Comment bài viết
   - ✅ Tự động tìm kiếm kết bạn

3. (Tùy chọn) Nếu chọn Comment:
   - Nhập danh sách comment (mỗi dòng 1 comment)
   - VD: 
     ```
     Tuyệt vời!
     Rất hay!
     Cảm ơn bạn!
     ```

4. (Tùy chọn) Nếu chọn Kết bạn:
   - Nhập từ khóa tìm kiếm
   - VD: "Nguyễn Văn A"

5. Điều chỉnh:
   - **Tốc độ**: 1-10 giây (mặc định: 3)
   - **Số lượng thao tác**: 1-100 (mặc định: 10)

### Bước 3: (Tùy chọn) Cấu Hình Multi-Account

1. Bật "Tự động chuyển tài khoản"
2. Nhập danh sách accounts (mỗi dòng: `email|password`):
   ```
   email1@example.com|password1
   email2@example.com|password2
   email3@example.com|password3
   ```
3. Đặt thời gian chuyển account (mặc định: 3 phút)
4. Chọn "Chạy xoay vòng" nếu muốn lặp lại

### Bước 4: (Tùy chọn) Cấu Hình Proxy

1. Bật "Sử dụng Proxy để đổi IP"
2. Nhập danh sách proxy (mỗi dòng 1 proxy):
   ```
   123.45.67.89:8080
   98.76.54.32:3128:user:pass
   111.222.333.444:8080|US
   ```
3. Chọn quốc gia ưu tiên (nếu có)
4. Bật "Đổi proxy khi chuyển account"

### Bước 5: Bắt Đầu

1. Click nút **"Bắt đầu"**
2. Xem log hoạt động trong phần "Log hoạt động"
3. Xem thống kê real-time trong phần "Thống kê"
4. Click **"Dừng"** khi muốn dừng automation

## ⚠️ Lưu Ý Quan Trọng

1. **Chỉ dùng cho mục đích học tập và nghiên cứu**
2. **Có thể vi phạm điều khoản Facebook** - Sử dụng có trách nhiệm
3. **Proxy**: Cần có proxy hợp lệ từ nhà cung cấp uy tín
4. **Tốc độ**: Không nên đặt quá nhanh để tránh bị phát hiện
5. **Số lượng**: Không nên đặt quá nhiều thao tác cùng lúc

## 🔧 Xử Lý Lỗi

### Extension không hiển thị
- Kiểm tra Developer mode đã bật chưa
- Reload extension trong `chrome://extensions/`

### Không tìm thấy nút Like/Comment
- Facebook có thể đã thay đổi giao diện
- Thử refresh trang và chạy lại

### Lỗi đăng nhập
- Kiểm tra email/password đúng chưa
- Kiểm tra có bị Facebook yêu cầu xác thực 2 yếu tố không

### Proxy không hoạt động
- Kiểm tra proxy có hợp lệ không
- Thử test proxy trước khi chạy
- Proxy cần hỗ trợ HTTP

## 📝 Format Dữ Liệu

### Accounts:
```
email1@example.com|password1
email2@example.com|password2
```

### Proxies:
```
IP:Port
IP:Port:Username:Password
IP:Port|Country
```

### Comments:
```
Comment 1
Comment 2
Comment 3
```

## ✅ Checklist Trước Khi Chạy

- [ ] Đã mở trang Facebook
- [ ] Đã chọn ít nhất 1 tính năng
- [ ] Đã nhập comment list (nếu dùng auto comment)
- [ ] Đã nhập từ khóa (nếu dùng auto friend)
- [ ] Đã nhập accounts (nếu dùng multi-account)
- [ ] Đã nhập proxies (nếu dùng proxy)
- [ ] Đã đặt tốc độ và số lượng hợp lý

---

**Chúc bạn sử dụng thành công! 🎉**

