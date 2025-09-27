import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import Swiper from 'swiper';
import { Pagination } from 'swiper/modules';

@Component({
  selector: 'app-gallery',
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css']
})
export class GalleryComponent implements AfterViewInit{
  images = [
    'https://picsum.photos/id/1024/1200/800',
    'https://picsum.photos/id/1018/1200/800',
    'https://picsum.photos/id/1015/1200/800',
    'https://picsum.photos/id/1016/1200/800',
    'https://picsum.photos/id/1020/1200/800'
  ];
  currentIndex = 1;
  swiper?: Swiper;
  @ViewChild('swiperEl') swiperEl!: ElementRef;


  ngAfterViewInit(): void {
    Swiper.use([Pagination]);
    this.swiper = new Swiper(this.swiperEl.nativeElement, {
      slidesPerView: 1,
      pagination: { el: '.swiper-pagination', clickable: true },
      on: {
        slideChange: () => {
          this.currentIndex = (this.swiper?.activeIndex || 0) + 1;
        }
      }
    });
  }
}