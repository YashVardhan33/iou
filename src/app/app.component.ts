import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, OnInit, Renderer2, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IOU, IouServiceService } from './service/iou-service.service';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    CommonModule, FormsModule,
    MatToolbarModule, MatSidenavModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatAutocompleteModule,
    MatButtonModule, MatCardModule, MatListModule, MatIconModule,
    MatDatepickerModule,
  ],
})
export class AppComponent implements OnInit {
  iouService = inject(IouServiceService);
  private renderer = inject(Renderer2);
  totalPay = 0;
  totalReceive = 0;
  netOverall = 0;
  editingIouId: number | null = null;

  filteredPayTotal = 0;
  filteredReceiveTotal = 0;
  filteredNetBalance = 0;
  friendPayTotal = 0;
  friendReceiveTotal = 0;
  friendNetBalance = 0;

  newIOU: Partial<IOU> & { date?: string } = {
    type: 'pay',
    status: 'pending',
  };

  friendSuggestions: string[] = [];
  allIOUs: IOU[] = [];
  displayedIOUs: IOU[] = [];
  recentIOUs: IOU[] = [];

  filterFriend = '';
  filterFromDate = '';
  filterToDate = '';
  filterStatus: 'all'|'pending'|'cleared' = 'all';

  isDesktop = window.innerWidth > 900;

  isDark = false;

  @ViewChild('shareSection', { static: false }) shareSection!: ElementRef;

  ngOnInit() {
    // Check for saved theme preference or default to system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDark = savedTheme === 'dark';
    } else {
      this.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    this.applyTheme();
    this.refreshAll();

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        this.isDark = e.matches;
        this.applyTheme();
      }
    });

    // Responsive recalc:
    window.addEventListener('resize', () => {
      this.isDesktop = window.innerWidth > 900;
    });
  }


  // === THEME SWITCH ===
  toggleTheme() {
    this.isDark = !this.isDark;
    this.applyTheme();
    // Save theme preference
    localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
  }

  private applyTheme() {
    if (this.isDark) {
      this.renderer.addClass(document.body, 'dark-theme');
    } else {
      this.renderer.removeClass(document.body, 'dark-theme');
    }
  }
  setThemeClass() {
    document.body.classList.toggle('dark', this.isDark);
  }

  refreshAll() {
    this.loadTotals();
    this.loadRecent();
    this.loadAllIOUs();
    this.loadFriendSuggestions();
  }

  loadTotals() {
    this.iouService.getTotalPayAmount().subscribe(total => {
      this.totalPay = total;
      this.updateNet();
    });
    this.iouService.getTotalReceiveAmount().subscribe(total => {
      this.totalReceive = total;
      this.updateNet();
    });
  }
  updateNet() {
    this.netOverall = this.totalReceive - this.totalPay;
  }
  loadRecent() {
    this.iouService.getAllIOUs().subscribe(ious => {
      this.recentIOUs = ious
        .sort((a, b) => b.id! - a.id!)
        .slice(0, 5);
    });
  }
  loadAllIOUs() {
    this.iouService.getAllIOUs().subscribe(ious => {
      this.allIOUs = ious.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this.applyFilters();
    });
  }
  loadFriendSuggestions() {
    this.iouService.getAllIOUs().subscribe(ious => {
      this.friendSuggestions = Array.from(new Set(ious.map(i => i.friend)));
    });
  }

  addIOU() {
    let date: string;
    if (this.newIOU.date) {
      date = new Date(`${this.newIOU.date}`).toISOString();
    } else {
      date = new Date().toISOString();
    }
    const newIou: IOU = {
      friend: this.newIOU.friend!,
      amount: this.newIOU.amount!,
      type: this.newIOU.type!,
      note: this.newIOU.note,
      status: 'pending',
      date: date,
    };
    this.iouService.addIOU(newIou).subscribe(() => {
      this.newIOU = { type: 'pay', status: 'pending' };
      this.refreshAll();
    });
  }

  markAsCleared(id: number | undefined) {
    if (id) {
      this.iouService.markAsCleared(id).subscribe(() => {
        this.refreshAll();
      });
    }
  }
  markAsPending(id: number | undefined) {
    if (id) {
      this.iouService.markAsPending(id).subscribe(() => {
        this.refreshAll();
      });
    }
  }

  applyFilters() {
    this.displayedIOUs = this.allIOUs.filter(iou => {
      const matchFriend = this.filterFriend
        ? iou.friend.toLowerCase().includes(this.filterFriend.toLowerCase())
        : true;
      const matchStatus = this.filterStatus === 'all'
        ? true
        : iou.status === this.filterStatus;
      const matchFromDate = this.filterFromDate
        ? new Date(iou.date) >= new Date(this.filterFromDate + 'T00:00:00')
        : true;
      const matchToDate = this.filterToDate
        ? new Date(iou.date) <= new Date(this.filterToDate + 'T23:59:59')
        : true;
      return matchFriend && matchStatus && matchFromDate && matchToDate;
    });

    const filtered = this.displayedIOUs;

    if (this.filterFriend.trim()) {
      this.friendPayTotal = filtered
        .filter(iou => iou.type === 'pay')
        .reduce((sum, iou) => sum + iou.amount, 0);
      this.friendReceiveTotal = filtered
        .filter(iou => iou.type === 'receive')
        .reduce((sum, iou) => sum + iou.amount, 0);
      this.friendNetBalance = this.friendReceiveTotal - this.friendPayTotal;
      this.filteredPayTotal = 0;
      this.filteredReceiveTotal = 0;
      this.filteredNetBalance = 0;
    } else {
      this.filteredPayTotal = filtered
        .filter(iou => iou.type === 'pay')
        .reduce((sum, iou) => sum + iou.amount, 0);
      this.filteredReceiveTotal = filtered
        .filter(iou => iou.type === 'receive')
        .reduce((sum, iou) => sum + iou.amount, 0);
      this.filteredNetBalance = this.filteredReceiveTotal - this.filteredPayTotal;
      this.friendPayTotal = 0;
      this.friendReceiveTotal = 0;
      this.friendNetBalance = 0;
    }
  }

  exportIOUs() {
    this.iouService.getAllIOUs().subscribe(ious => {
      const blob = new Blob([JSON.stringify(ious)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ious_backup.json';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }
  async importIOUs(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const json = reader.result as string;
      try {
        const imported: IOU[] = JSON.parse(json);
        for (const iou of imported) {
          delete iou.id;
          await firstValueFrom(this.iouService.addIOU(iou));
        }
        this.refreshAll();
      } catch (err) {
        console.error('Invalid JSON', err);
      }
      input.value = '';
    };
    reader.readAsText(file);
  }
  clearMutualIOUs() {
    this.iouService.clearMutualIOUs().subscribe(() => {
      this.refreshAll();
    });
  }
  deleteIOU(id: number | undefined) {
    if (id) {
      this.iouService.deleteIOU(id).subscribe(() => {
        this.refreshAll();
      });
    }
  }
  startEdit(iou: IOU) {
    this.editingIouId = iou.id!;
  }
  cancelEdit() {
    this.editingIouId = null;
    this.refreshAll();
  }
  saveEdit(iou: IOU) {
    this.iouService.updateIOU(iou).subscribe(() => {
      this.editingIouId = null;
      this.refreshAll();
    });
  }

  // IMAGE/PDF SHARE SECTION
  async shareAsImage() {
    const target = document.getElementById('shareSectionToExport');
    if (!target) return;
      try{
        const canvas = await html2canvas(target,{
          backgroundColor: '#ffffff',
          scale:2,
          useCORS: true,
          allowTaint: false
        });
        const image = canvas.toDataURL('image/png');
        if (navigator.canShare()&&(navigator as any).canShare({files: []})) {
          const response  = await fetch(image);
          const blob = await response.blob();
          const file = new File([blob],'IOU-summary.png',{type: 'image/png'});

          await (navigator as any ).share({files: [file], title: "IOU summary"});

        }
         else {
        const a = document.createElement('a');
        a.href = image;
        a.download = 'iou-summary.png';
        a.click();
      }

      }



////
    catch (error) {
      console.error('Error generating image:', error);
    }
  }
  // async shareAsPdf() {
  //   const target = document.getElementById('shareSectionToExport');
  //   if (!target) return;
  //   const canvas = await html2canvas(target, { backgroundColor: null, scale: 2 });
  //   const imgData = canvas.toDataURL('image/png');
  //   const pdf = new jsPDF('p', 'pt', 'a4');
  //   const pdfWidth = pdf.internal.pageSize.getWidth();
  //   const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  //   pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  //   pdf.save('iou-summary.pdf');
  // }


  async shareAsPdf() {
    const target = document.getElementById('shareSectionToExport');
    if (!target) return;

    try {
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('iou-summary.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  }

}
