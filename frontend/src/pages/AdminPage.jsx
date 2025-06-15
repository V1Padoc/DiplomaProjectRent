// frontend/src/pages/AdminPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/20/solid';

// Helper function to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A'; // Keep 'N/A' as it's a common abbreviation, or translate to 'Н/Д' if desired.
    return new Date(dateString).toLocaleDateString('uk-UA', { year: 'numeric', month: 'short', day: 'numeric' }); // Changed to Ukrainian locale
};

const columnHelper = createColumnHelper();

function AdminPage() {
    const { user, token, refreshAdminTasksCount, authLoading } = useAuth();
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [filterStatus, setFilterStatus] = useState('pending');
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });
    const [pageCount, setPageCount] = useState(0);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalAction, setModalAction] = useState(null); // 'reject' or 'archive'
    const [modalTargetListing, setModalTargetListing] = useState(null);
    const [actionReason, setActionReason] = useState('');
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);
    const [modalError, setModalError] = useState('');


    const fetchData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (filterStatus) {
                params.append('status', filterStatus);
            }
            params.append('page', pagination.pageIndex + 1);
            params.append('limit', pagination.pageSize);

            const response = await axios.get(`http://localhost:5000/api/admin/listings?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setListings(response.data.listings);
            setPageCount(response.data.totalPages);

            if (user?.role === 'admin') {
                refreshAdminTasksCount();
            }

        } catch (err) {
            console.error("Error fetching listings for admin:", err);
            setError(err.response?.data?.message || "Не вдалося завантажити оголошення.");
        } finally {
            setLoading(false);
        }
    }, [token, filterStatus, pagination.pageIndex, pagination.pageSize, user?.role, refreshAdminTasksCount]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openActionModal = (listing, actionType) => {
        setModalTargetListing(listing);
        setModalAction(actionType);
        setActionReason('');
        setModalError('');
        setIsModalOpen(true);
    };

    const handleConfirmAction = async () => {
        if (!modalTargetListing || !modalAction) return;
        
        setIsSubmittingAction(true);
        setModalError('');

        const { id: listingId, Owner: listingOwner } = modalTargetListing;
        const newStatus = modalAction;

        try {
            // Step 1: Update listing status
            await axios.put(
                `http://localhost:5000/api/admin/listings/${listingId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Step 2: If reason provided, send a message
            if (actionReason.trim() && listingOwner && listingOwner.id) {
                try {
                    await axios.post(
                        `http://localhost:5000/api/chats/send`,
                        {
                            listing_id: listingId,
                            content: actionReason.trim(),
                            receiver_id: listingOwner.id, // Admin (sender) sends to Owner (receiver)
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (messageError) {
                    // Log message error but don't necessarily fail the whole operation
                    // The status update was successful.
                    console.error(`Failed to send message for listing ${listingId}:`, messageError);
                    setModalError(`Статус оновлено, але не вдалося надіслати повідомлення: ${messageError.response?.data?.message || messageError.message}. Ви можете спробувати написати власнику безпосередньо у 'Моїх чатах'.`);
                    // Keep modal open to show this specific error, or decide to close.
                    // For now, let's close and rely on fetchData to refresh. The error is logged.
                    // Or, we can show this error and then close after a delay or on next click.
                    // For simplicity, we'll proceed to close. A more robust UI might handle this better.
                }
            }
            
            // Close modal and refetch data
            setIsModalOpen(false);
            setModalTargetListing(null);
            setModalAction(null);
            setActionReason('');
            fetchData(); // This will also refresh admin tasks count

        } catch (err) {
            console.error(`Error updating listing ${listingId} to ${newStatus}:`, err);
            setModalError(err.response?.data?.message || `Не вдалося оновити статус. ${err.message}`);
        } finally {
            setIsSubmittingAction(false);
        }
    };
    
    // This function is for direct status updates without a modal (e.g., Approve)
    const handleDirectUpdateStatus = async (listingId, newStatus) => {
        const originalListings = [...listings];
        setListings(prev => prev.map(l => l.id === listingId ? {...l, isUpdating: true} : l));
        try {
            await axios.put(
                `http://localhost:5000/api/admin/listings/${listingId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchData(); 
        } catch (err) {
            console.error(`Error updating listing ${listingId} to ${newStatus}:`, err);
            alert(err.response?.data?.message || `Не вдалося оновити статус. ${err.message}`);
            setListings(originalListings.map(l => l.id === listingId ? {...l, isUpdating: false} : l)); 
        }
    };


    const columns = useMemo(() => [
        columnHelper.accessor('id', {
            header: 'ІД',
            cell: info => <span className="font-mono text-xs text-slate-700">{info.getValue()}</span>,
            size: 60,
        }),
        columnHelper.accessor('title', {
            header: 'Заголовок',
            cell: info => (
                <Link to={`/listings/${info.row.original.id}`} className="text-blue-600 hover:text-blue-700 hover:underline font-medium" target="_blank" rel="noopener noreferrer">
                    {info.getValue()}
                </Link>
            ),
        }),
        columnHelper.accessor('Owner', {
            header: 'Власник',
            cell: info => {
                const owner = info.getValue();
                if (!owner) return <span className="text-slate-500">Н/Д</span>;
                const ownerName = `${owner.name || ''} ${owner.last_name || ''}`.trim();
                const displayIdentifier = ownerName || owner.email || `ІД Користувача: ${owner.id}`;
                return (
                    <div>
                        <Link to={`/profiles/${owner.id}`} className="text-blue-600 hover:text-blue-700 hover:underline font-medium" target="_blank" rel="noopener noreferrer">
                            {displayIdentifier}
                        </Link>
                        {owner.email && <div className="text-xs text-slate-500">{owner.email}</div>}
                    </div>
                );
            },
        }),
        columnHelper.accessor('price', {
            header: 'Ціна',
            cell: info => {
                const price = parseFloat(info.getValue());
                const type = info.row.original.type;
                let priceDisplay = `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                if (type === 'monthly-rental') priceDisplay += '/міс';
                else if (type === 'daily-rental') priceDisplay += '/день';
                return <span className="font-medium text-slate-800">{priceDisplay}</span>;
            },
        }),
        columnHelper.accessor('status', {
            header: 'Статус',
            cell: info => {
                const status = info.getValue();
                let bgColor = 'bg-slate-100'; let textColor = 'text-slate-700';
                let displayStatus = '';

                switch (status) {
                    case 'active':
                        bgColor = 'bg-green-100'; textColor = 'text-green-700';
                        displayStatus = 'Активне';
                        break;
                    case 'pending':
                        bgColor = 'bg-yellow-100'; textColor = 'text-yellow-700';
                        displayStatus = 'На розгляді';
                        break;
                    case 'rejected':
                        bgColor = 'bg-red-100'; textColor = 'text-red-700';
                        displayStatus = 'Відхилено';
                        break;
                    case 'archived':
                        bgColor = 'bg-neutral-100'; textColor = 'text-neutral-700';
                        displayStatus = 'В архіві';
                        break;
                    default:
                        displayStatus = status; // Fallback if status is unexpected
                }
                return <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${bgColor} ${textColor} border ${bgColor.replace('bg-','border-')}`}>{displayStatus}</span>;
            },
        }),
        columnHelper.accessor('created_at', {
            header: 'Подано',
            cell: info => <span className="text-slate-600">{formatDate(info.getValue())}</span>,
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Дії',
            cell: ({ row }) => {
                const listing = row.original;
                if (listing.isUpdating) {
                    return <span className="text-xs text-slate-500 animate-pulse">Оновлення...</span>;
                }
                return (
                    <div className="flex space-x-1 sm:space-x-2">
                        {listing.status === 'pending' && (
                            <>
                                <button
                                    onClick={() => handleDirectUpdateStatus(listing.id, 'active')}
                                    className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold py-1.5 px-2.5 sm:px-3 rounded-md transition-colors"
                                >
                                    Схвалити
                                </button>
                                <button
                                    onClick={() => openActionModal(listing, 'rejected')}
                                    className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold py-1.5 px-2.5 sm:px-3 rounded-md transition-colors"
                                >
                                    Відхилити
                                </button>
                            </>
                        )}
                        {listing.status === 'active' && (
                            <>
                                <button
                                    onClick={() => openActionModal(listing, 'rejected')}
                                    className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold py-1.5 px-2.5 sm:px-3 rounded-md transition-colors"
                                >
                                    Відхилити
                                </button>
                                <button
                                    onClick={() => openActionModal(listing, 'archived')}
                                    className="text-xs bg-slate-500 hover:bg-slate-600 text-white font-semibold py-1.5 px-2.5 sm:px-3 rounded-md transition-colors"
                                >
                                    Архівувати
                                </button>
                            </>
                        )}
                         {listing.status === 'rejected' && (
                             <button
                                onClick={() => handleDirectUpdateStatus(listing.id, 'active')}
                                className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold py-1.5 px-2.5 sm:px-3 rounded-md transition-colors"
                            >
                                Повторно схвалити
                            </button>
                        )}
                         {listing.status === 'archived' && (
                             <button
                                onClick={() => handleDirectUpdateStatus(listing.id, 'active')}
                                className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold py-1.5 px-2.5 sm:px-3 rounded-md transition-colors"
                            >
                                Розархівувати
                            </button>
                        )}
                    </div>
                );
            },
        }),
    ], [token, fetchData]); // Removed handleDirectUpdateStatus and openActionModal from deps, they use useCallback or are stable

    const table = useReactTable({
        data: listings,
        columns,
        pageCount: pageCount,
        state: { pagination },
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: true,
        debugTable: false,
    });

    if (authLoading || (loading && listings.length === 0 && !error)) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-[#0c151d]" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Завантаження...</div>;
    }
     if (!user || user.role !== 'admin') {
        return <div className="flex justify-center items-center min-h-screen bg-slate-50 text-xl text-center text-[#0c151d] p-10" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Доступ заборонено. Ви повинні бути адміністратором, щоб переглядати цю сторінку.</div>;
    }
    if (error) {
        return <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-center my-6 mx-auto max-w-lg" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>Помилка: {error}</div>;
    }

    return (
        <div className="relative flex size-full min-h-screen flex-col bg-slate-50" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
            <div className="flex-1 py-5 px-4 sm:px-6 lg:px-8">
                <div className="max-w-none mx-auto">
                    <h1 className="text-[#0c151d] tracking-tight text-xl sm:text-2xl md:text-[32px] font-bold leading-tight mb-8">
                        Панель адміністратора - Модерація оголошень
                    </h1>

                    <div className="mb-6">
                        <label htmlFor="statusFilter" className="mr-2 text-sm font-medium text-[#4574a1]">Фільтрувати за статусом:</label>
                        <select
                            id="statusFilter"
                            value={filterStatus}
                            onChange={(e) => {
                                setFilterStatus(e.target.value);
                                setPagination(prev => ({ ...prev, pageIndex: 0 })); 
                            }}
                            className="form-select rounded-lg border border-[#cddcea] bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-11 py-2 px-3 text-sm text-[#0c151d]"
                        >
                            <option value="pending">На розгляді</option>
                            <option value="active">Активне</option>
                            <option value="rejected">Відхилено</option>                   
                            <option value="archived">В архіві</option>
                            <option value="">Усі</option>
                        </select>
                    </div>

                    {listings.length === 0 && !loading ? (
                        <p className="text-center text-slate-600 py-10">Оголошень за вибраним статусом не знайдено.</p>
                    ) : (
                    <div className="overflow-x-auto bg-white shadow-xl rounded-xl">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-100">
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map(header => (
                                            <th
                                                key={header.id}
                                                scope="col" 
                                                className="px-4 sm:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"
                                                style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {table.getRowModel().rows.map(row => (
                                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-700 align-top">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )}

                    {pageCount > 1 && (
                         <div className="mt-8 flex items-center justify-center p-4 space-x-1.5 sm:space-x-2">
                            <button 
                                onClick={() => table.previousPage()} 
                                disabled={!table.getCanPreviousPage()}
                                className="flex size-9 sm:size-10 items-center justify-center rounded-full text-[#0c151d] hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors">
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            
                            {Array.from({ length: table.getPageCount() }).map((_, i) => {
                                const pageNum = i + 1;
                                const currentPageIndex = table.getState().pagination.pageIndex;
                                const totalPages = table.getPageCount();
                                const showPage = Math.abs(i - currentPageIndex) < 2 || i === 0 || i === totalPages -1 || (Math.abs(i - currentPageIndex) < 3 && (currentPageIndex < 2 || currentPageIndex > totalPages - 3));
                                
                                if (!showPage) {
                                     if (i === 1 && currentPageIndex > 2) return <span key="dots-start" className="px-1 sm:px-2 text-sm text-slate-600">...</span>;
                                     if (i === totalPages - 2 && currentPageIndex < totalPages - 3) return <span key="dots-end" className="px-1 sm:px-2 text-sm text-slate-600">...</span>;
                                     return null;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => table.setPageIndex(i)}
                                        disabled={loading}
                                        className={`text-sm font-medium leading-normal tracking-[0.015em] flex size-9 sm:size-10 items-center justify-center rounded-full transition-colors
                                                   ${currentPageIndex === i ? 'bg-[#e6edf4] text-[#0c151d] font-bold' : 'text-[#0c151d] hover:bg-slate-200'}
                                                   ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button 
                                onClick={() => table.nextPage()} 
                                disabled={!table.getCanNextPage()}
                                className="flex size-9 sm:size-10 items-center justify-center rounded-full text-[#0c151d] hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-transparent transition-colors">
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for Reason Input */}
            {isModalOpen && modalTargetListing && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out" style={{ fontFamily: 'Inter, "Noto Sans", sans-serif' }}>
                    <div className="bg-white rounded-lg shadow-xl p-5 sm:p-6 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg sm:text-xl font-semibold text-[#0c151d]">
                              {modalAction === 'rejected' ? 'Причина відхилення' : 'Причина архівування'}                  </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-1">
                            Оголошення: <span className="font-medium">{modalTargetListing.title}</span>
                        </p>
                        <p className="text-sm text-slate-600 mb-4">
                            Власник: <span className="font-medium">{modalTargetListing.Owner?.name || modalTargetListing.Owner?.email || 'Н/Д'}</span>
                        </p>

                        <form onSubmit={(e) => { e.preventDefault(); handleConfirmAction(); }}>
                            <div className="mb-4">
                                <label htmlFor="actionReason" className="block text-sm font-medium text-slate-700 mb-1">
                                    Причина (необов'язково):
                                </label>
                                <textarea
                                    id="actionReason"
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    rows="3"
                                   className="form-textarea w-full rounded-md border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-[#0d151c] placeholder-slate-400 py-2 px-3 shadow-sm"
                                    placeholder={`Введіть причину ${modalAction === 'rejected' ? 'відхилення' : 'архівування'}... Якщо вказано, власнику буде надіслано повідомлення.`}
                                />
                                {!(modalTargetListing.Owner && modalTargetListing.Owner.id) && actionReason.trim() && (
                                     <p className="text-xs text-yellow-600 mt-1">
                                        Увага: Дані власника не знайдено. Повідомлення не може бути надіслано.
                                     </p>
                                )}
                            </div>

                            {modalError && (
                                <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-md mb-4 text-sm">
                                    {modalError}
                                </div>
                            )}

                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSubmittingAction}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 disabled:opacity-50"
                                >
                                    Скасувати
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingAction || (!(modalTargetListing.Owner && modalTargetListing.Owner.id) && actionReason.trim())}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmittingAction ? 
                                         (modalAction === 'rejected' ? 'Відхилення...' : 'Архівування...') : 
                                        (modalAction === 'rejected' ? 'Підтвердити відхилення' : 'Підтвердити архівування')          }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .form-select, .form-textarea { @apply shadow-sm appearance-none; }
                .tracking-tight { letter-spacing: -0.025em; }
                /* For modal entrance/exit */
                .transition-opacity { transition-property: opacity; }
                .transition-all { transition-property: all; }
                .scale-100 { transform: scale(1); }
            `}</style>
        </div>
    );
}

export default AdminPage;